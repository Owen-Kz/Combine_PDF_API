// backend/controllers/editors/myPreviousSubmissions.js
const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");
const { stripDerivedSuffix } = require("../utils/submissionIdUtils");
const {
  getFamilyCache,
  getFamilyArticleIds,
} = require("./familyMap");

// ---------------------------------------------------------------------------
// Unified controller: fetch every revision of the manuscript's family.
//
//   - Admins / editor-in-chief see ALL submissions in the family, across all
//     authors.
//   - Everyone else sees only the families they're explicitly assigned to
//     (submitted_for_edit OR invitations for 'To Edit' / 'To Decide').
//
// The manuscript identifier can come from the URL param OR the request body:
//   URL:  /editors/allPreviousSubmissions/:manuscriptId
//   Body: { revision_id | item_id | article_id }
//
// Route registration (see below) mounts this same handler on both endpoints.
// ---------------------------------------------------------------------------

// Statuses that never appear in "previous submissions" lists.
const EXCLUDED_STATUSES = ['saved_for_later', 'revision_saved', 'returned'];
const EXCLUDED_IN_SQL = EXCLUDED_STATUSES.map((s) => `'${s}'`).join(',');

// ─────────────────────────────────────────────────────────────────────────────
// Row formatter — shared by every response path.
// ─────────────────────────────────────────────────────────────────────────────
const formatSubmission = (row, { mainId, originalRevisionId }) => {
    const authorParts = [row.prefix, row.firstname, row.lastname].filter(Boolean);
    const authorName = authorParts.join(' ') || 'Unknown';
    const correspondingAuthor = authorParts.length > 0
        ? authorParts.join(' ')
        : (row.corresponding_email?.split('@')[0] || 'Unknown');

    const files = {};
    if (row.manuscript_file)         files.manuscript = row.manuscript_file;
    if (row.document_file)           files.document = row.document_file;
    if (row.tracked_manuscript_file) files.tracked_manuscript = row.tracked_manuscript_file;
    if (row.cover_letter_file)       files.cover_letter = row.cover_letter_file;
    if (row.tables)                  files.tables = row.tables;
    if (row.figures)                 files.figures = row.figures;
    if (row.graphic_abstract)        files.graphic_abstract = row.graphic_abstract;
    if (row.supplementary_material)  files.supplementary = row.supplementary_material;

    return {
        id: row.family_id || row.article_id,
        family_id: row.family_id || row.article_id,
        article_id: row.article_id,
        revision_id: row.revision_id,
        revisions_count: row.revisions_count,
        corrections_count: row.corrections_count,
        previous_manuscript_id: row.previous_manuscript_id,
        title: row.title,
        abstract: row.abstract,
        type: row.article_type,
        discipline: row.discipline,
        status: row.status,
        date: (row.date_submitted || row.process_start_date)
            ? new Date(row.date_submitted || row.process_start_date).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
            })
            : 'N/A',
        submittedDate: row.date_submitted || row.process_start_date,
        updatedAt: row.last_updated,
        isWomenInScience:      row.is_women_in_science === 'yes' || row.is_women_in_science == 1,
        isBelispointAcademic:  row.is_belispoint_academic === 'yes' || row.is_belispoint_academic == 1,
        isKidnappingForRansom: row.is_kidnapping_for_ransom === 'yes' || row.is_kidnapping_for_ransom == 1,
        authors: authorName,
        correspondingAuthor,
        correspondingEmail: row.corresponding_email,
        authorEmail: row.author_email,
        orcidId: row.orcid_id,
        affiliations: row.affiliations,
        reviewerInvitations: {
            accepted: row.accepted_reviewers || 0,
            declined: row.declined_reviewers || 0,
            pending:  row.pending_reviewers  || 0,
        },
        editorInvitations: {
            accepted: row.accepted_editors || 0,
            declined: row.declined_editors || 0,
            pending:  row.pending_editors  || 0,
        },
        files,
        isCurrentVersion:
            row.revision_id === mainId || row.revision_id === originalRevisionId,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Main handler — works for both admin and non-admin requests.
// ─────────────────────────────────────────────────────────────────────────────
const myPreviousSubmissions = async (req, res) => {
    console.log("jango")
    try {
        const userEmail = req.user?.email;

        // Accept the ID from URL param, body, or query — whichever the
        // caller supplied. This lets the same handler serve both
        //   GET  /editors/myPreviousSubmissions/:manuscriptId
        //   POST /editors/allPreviousSubmissions/:manuscriptId
        const rawId =
            req.params?.manuscriptId ||
            req.body?.revision_id ||
            req.body?.item_id ||
            req.body?.article_id ||
            req.query?.revision_id ||
            req.query?.item_id;

        if (!userEmail || !rawId) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Parameters',
            });
        }

        const originalRevisionId = String(rawId);
        const mainId = originalRevisionId;
        const revisionId = stripDerivedSuffix(originalRevisionId);

        // ─────────────────────────────────────────────────────────────────────
        // 1) Resolve the seed row from any identifier variant.
        // ─────────────────────────────────────────────────────────────────────
        const [seedRows] = await db.promise().query(
            `SELECT id, article_id, revision_id, previous_manuscript_id, title
               FROM submissions
              WHERE revision_id = ?
                 OR article_id = ?
                 OR id = ?
              ORDER BY (revision_id = ?) DESC, id DESC
              LIMIT 1`,
            [revisionId, revisionId, revisionId, revisionId]
        );

        if (seedRows.length === 0) {
            return res.json({
                success: true,
                submissions: [],
                message: 'No previous submissions found',
            });
        }

        const seed = seedRows[0];

        // ─────────────────────────────────────────────────────────────────────
        // 2) Determine visibility scope. Handle sync OR async isAdminAccount.
        // ─────────────────────────────────────────────────────────────────────
        let isAdmin = false;
        try {
            isAdmin = await Promise.resolve(isAdminAccount(userEmail));
        } catch (err) {
            console.error('isAdminAccount check failed, defaulting to non-admin:', err);
            isAdmin = false;
        }

        // ─────────────────────────────────────────────────────────────────────
        // 3) Resolve the family via the shared cached family map. This is the
        //    same union-find result used by every other controller, so the
        //    set of related submissions here matches what the dashboard
        //    shows.
        // ─────────────────────────────────────────────────────────────────────
        const { map: familyMap, familyMembers } = await getFamilyCache();

        const familyId = familyMap.get(seed.article_id) || seed.article_id;
        const familyArticleIds = getFamilyArticleIds(familyId, familyMembers);

        if (familyArticleIds.length === 0) {
            return res.json({ success: true, submissions: [] });
        }

        // ─────────────────────────────────────────────────────────────────────
        // 4) Non-admin: verify they're assigned to this family before
        //    returning anything. Admin skips this check.
        //
        //    We check for an assignment link on ANY member of the family
        //    rather than just the seed, so an editor invited to a revision
        //    still sees the whole family.
        // ─────────────────────────────────────────────────────────────────────
        if (!isAdmin) {
            const [assignmentRows] = await db.promise().query(
                `SELECT 1
                   FROM submitted_for_edit sfe
                  WHERE sfe.editor_email = ?
                    AND sfe.status NOT IN ('declined', 'canceled', 'expired')
                    AND (sfe.article_id IN (?))
                  UNION
                 SELECT 1
                   FROM invitations i
                  WHERE i.invited_user = ?
                    AND i.invited_for IN ('To Edit', 'To Decide')
                    AND i.invitation_status NOT IN ('declined', 'canceled', 'expired')
                    AND (i.invitation_link IN (?))
                  LIMIT 1`,
                [
                    userEmail, familyArticleIds,
                    userEmail, familyArticleIds,
                ]
            );

            if (assignmentRows.length === 0) {
                return res.json({
                    success: true,
                    submissions: [],
                    message: 'No previous submissions found',
                });
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 5) Fetch every submission in the family. Same query for both roles —
        //    the assignment check above already gated access for non-admins.
        //
        //    Revisions of the family chain are covered because the family map
        //    includes both `previous_manuscript_id` descendants and title
        //    variants of the seed.
        // ─────────────────────────────────────────────────────────────────────
        const [results] = await db.promise().query(
            `SELECT
               s.id,
               s.article_id,
               s.revision_id,
               s.revisions_count,
               s.corrections_count,
               s.previous_manuscript_id,
               s.title,
               s.abstract,
               s.article_type,
               s.discipline,
               s.status,
               s.date_submitted,
               s.process_start_date,
               s.last_updated,
               s.is_women_in_contemporary_science AS is_women_in_science,
               s.is_kidnapping_for_ransom         AS is_kidnapping_for_ransom,
               s.is_belispoint_academic           AS is_belispoint_academic,
               s.corresponding_authors_email      AS corresponding_email,
               s.manuscript_file,
               s.document_file,
               s.tracked_manuscript_file,
               s.cover_letter_file,
               s.tables,
               s.figures,
               s.graphic_abstract,
               s.supplementary_material,
               a.firstname,
               a.lastname,
               a.email AS author_email,
               a.orcid_id,
               a.affiliations,
               a.prefix,
               (SELECT COUNT(*) FROM invitations
                 WHERE invitation_link = s.revision_id
                   AND invited_for = 'Submission Review'
                   AND invitation_status IN ('accepted','review_invitation_accepted','review_submitted')
               ) AS accepted_reviewers,
               (SELECT COUNT(*) FROM invitations
                 WHERE invitation_link = s.revision_id
                   AND invited_for = 'Submission Review'
                   AND invitation_status = 'declined'
               ) AS declined_reviewers,
               (SELECT COUNT(*) FROM invitations
                 WHERE invitation_link = s.revision_id
                   AND invited_for = 'Submission Review'
                   AND invitation_status = 'invite_sent'
               ) AS pending_reviewers,
               (SELECT COUNT(*) FROM invitations
                 WHERE invitation_link = s.revision_id
                   AND invited_for = 'To Edit'
                   AND invitation_status IN ('accepted','edit_invitation_accepted','edit_submitted')
               ) AS accepted_editors,
               (SELECT COUNT(*) FROM invitations
                 WHERE invitation_link = s.revision_id
                   AND invited_for = 'To Edit'
                   AND invitation_status = 'declined'
               ) AS declined_editors,
               (SELECT COUNT(*) FROM invitations
                 WHERE invitation_link = s.revision_id
                   AND invited_for = 'To Edit'
                   AND invitation_status = 'invite_sent'
               ) AS pending_editors
             FROM submissions s
             LEFT JOIN authors_account a ON s.corresponding_authors_email = a.email
            WHERE s.article_id IN (?)
              AND s.title != ''
              AND s.title != 'Draft Submission'
              AND s.status NOT IN (${EXCLUDED_IN_SQL})
            ORDER BY
              CASE WHEN s.revision_id = ? THEN 0 ELSE 1 END,
              s.id DESC`,
            [familyArticleIds, mainId]
        );

        // Dedupe — one row per revision_id in case the same revision appears
        // under multiple article_ids (shouldn't happen, but defensive).
        const byRevision = new Map();
        for (const row of results) {
            const key = row.revision_id || row.id;
            const existing = byRevision.get(key);
            if (!existing || row.id > existing.id) byRevision.set(key, row);
        }

        const submissions = [...byRevision.values()].sort((a, b) => {
            // Current revision first, then most recent id
            const aCurrent = a.revision_id === mainId || a.revision_id === originalRevisionId;
            const bCurrent = b.revision_id === mainId || b.revision_id === originalRevisionId;
            if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
            return b.id - a.id;
        });

        // Stamp family_id on each row so the formatter can echo it back.
        for (const row of submissions) {
            row.family_id = familyMap.get(row.article_id) || row.article_id;
        }

        const formattedSubmissions = submissions.map((row) =>
            formatSubmission(row, { mainId, originalRevisionId })
        );

        return res.json({
            success: true,
            submissions: formattedSubmissions,
            total: formattedSubmissions.length,
        });
    } catch (error) {
        console.error('Error in myPreviousSubmissions:', error);
        return res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message,
        });
    }
};

module.exports = myPreviousSubmissions;