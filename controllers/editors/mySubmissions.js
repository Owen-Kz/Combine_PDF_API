// backend/controllers/editors/mySubmissions.js
const db = require("../../routes/db.config");

// Shared subquery: the set of article_ids the current editor is associated with.
// Union of:
//   1. Rows in submitted_for_edit (formal edit assignment)
//   2. Rows in invitations where the editor was invited to edit
// UNION dedupes so a manuscript that appears in both tables is counted once.
const ASSIGNED_ARTICLES_SUBQUERY = `
  SELECT DISTINCT article_id
    FROM submitted_for_edit
   WHERE editor_email = ?
  UNION
  SELECT DISTINCT invitation_link AS article_id
    FROM invitations
   WHERE invited_user = ?
     AND invited_for IN ('To Edit', 'To Decide')
     AND invitation_status NOT IN ('declined', 'canceled', 'expired')
`;

const mySubmissions = async (req, res) => {
    try {
        const editorEmail = req.user?.email;
        const editorId = req.user?.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        if (!editorEmail || !editorId) {
            return res.status(400).json({ success: false, error: "Invalid Parameters" });
        }

        // ---------------------------------------------------------------------
        // Step 1: build the assigned-articles query (with optional search filter)
        // ---------------------------------------------------------------------
        const searchPattern = `%${search}%`;
        const hasSearch = search && search.length >= 2;

        // Base assigned-articles query, optionally narrowed by search.
        // When search is present, we filter the UNION result by joining against
        // submissions and authors — keeping the search logic in one place.
        const assignedQuery = hasSearch
            ? `
              SELECT DISTINCT aa.article_id
                FROM (${ASSIGNED_ARTICLES_SUBQUERY}) AS aa
                INNER JOIN submissions s ON s.article_id = aa.article_id
                LEFT JOIN authors_account a ON s.corresponding_authors_email = a.email
               WHERE s.title != '' AND s.title != 'Draft Submission'
                 AND (
                       s.title       LIKE ?
                    OR s.article_id  LIKE ?
                    OR s.revision_id LIKE ?
                    OR s.status      LIKE ?
                    OR a.firstname   LIKE ?
                    OR a.lastname    LIKE ?
                 )
            `
            : `SELECT DISTINCT article_id FROM (${ASSIGNED_ARTICLES_SUBQUERY}) AS aa`;

        // Parameters for the scoped subquery (2 placeholders: email, invited_user)
        const scopeParams = [editorEmail, editorEmail];

        // Full param list for the count query (scope + optional search)
        const countParams = hasSearch
            ? [...scopeParams, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
            : scopeParams;

        // ---------------------------------------------------------------------
        // Step 2: total count for pagination
        // ---------------------------------------------------------------------
        const [countResult] = await db.promise().query(
            `SELECT COUNT(*) AS total FROM (${assignedQuery}) AS temp`,
            countParams
        );

        const total = countResult[0]?.total || 0;
        if (total === 0) {
            return res.json({
                success: true,
                submissions: [],
                total: 0,
                totalPages: 0,
                currentPage: page,
                limit,
            });
        }

        // ---------------------------------------------------------------------
        // Step 3: fetch the paginated page of article_ids
        // ---------------------------------------------------------------------
        const pagedParams = hasSearch
            ? [...countParams, limit, offset]
            : [...scopeParams, limit, offset];

        const [assignedArticles] = await db.promise().query(
            `${assignedQuery} LIMIT ? OFFSET ?`,
            pagedParams
        );

        if (assignedArticles.length === 0) {
            return res.json({
                success: true,
                submissions: [],
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                limit,
            });
        }

        const articleIds = assignedArticles.map((row) => row.article_id);

        // ---------------------------------------------------------------------
        // Step 4: fetch the latest revision of each assigned manuscript
        // ---------------------------------------------------------------------
        const submissionsQuery = `
            WITH RankedSubmissions AS (
                SELECT
                    s.id,
                    s.article_id,
                    s.revision_id,
                    s.revisions_count,
                    s.corrections_count,
                    s.title,
                    s.abstract,
                    s.article_type,
                    s.discipline,
                    s.status,
                    s.date_submitted,
                    s.process_start_date,
                    s.last_updated,
                    s.is_women_in_contemporary_science AS is_women_in_science,
                    s.is_kidnapping_for_ransom AS is_kidnapping_for_ransom,
                    s.is_belispoint_academic AS is_belispoint_academic,
                    s.corresponding_authors_email AS corresponding_email,
                    s.previous_manuscript_id AS previous_manuscript_id,
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
                    ROW_NUMBER() OVER (
                        PARTITION BY s.article_id
                        ORDER BY s.revision_id DESC, s.process_start_date DESC
                    ) AS row_num,

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
                    ) AS pending_editors,

                    (SELECT COUNT(*) FROM invitations inv2
                      WHERE inv2.invitation_link = s.revision_id
                        AND inv2.invited_for = 'To Decide'
                        AND inv2.invitation_status IN ('pending','invite_sent')
                        AND inv2.decision_viewed = 0
                        AND inv2.invited_user = ?
                    ) AS new_reviews

                FROM submissions s
                LEFT JOIN authors_account a ON s.corresponding_authors_email = a.email
                WHERE s.article_id IN (?)
            )
            SELECT *
              FROM RankedSubmissions
             WHERE row_num = 1
             ORDER BY id DESC
        `;

        const [submissions] = await db.promise().query(submissionsQuery, [editorEmail, articleIds]);

        // ---------------------------------------------------------------------
        // Step 5: format results
        // ---------------------------------------------------------------------
        const formattedSubmissions = submissions.map((row) => {
            let authorName = 'Unknown';
            if (row.firstname && row.lastname) {
                authorName = `${row.firstname} ${row.lastname}`;
            } else if (row.firstname) {
                authorName = row.firstname;
            } else if (row.lastname) {
                authorName = row.lastname;
            }
            if (row.prefix && authorName !== 'Unknown') {
                authorName = `${row.prefix} ${authorName}`;
            }

            const files = {};
            if (row.manuscript_file) files.manuscript = row.manuscript_file;
            if (row.document_file) files.document = row.document_file;
            if (row.tracked_manuscript_file) files.tracked_manuscript = row.tracked_manuscript_file;
            if (row.cover_letter_file) files.cover_letter = row.cover_letter_file;
            if (row.tables) files.tables = row.tables;
            if (row.figures) files.figures = row.figures;
            if (row.graphic_abstract) files.graphic_abstract = row.graphic_abstract;
            if (row.supplementary_material) files.supplementary = row.supplementary_material;

            return {
                id: row.article_id,
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
                date: new Date(row.process_start_date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                }),
                submittedDate: row.date_submitted || row.process_start_date,
                updatedAt: row.last_updated,
                isWomenInScience: row.is_women_in_science === 'yes' || row.is_women_in_science == 1,
                isBelispointAcademic: row.is_belispoint_academic === 'yes' || row.is_belispoint_academic == 1,
                isKidnappingForRansom: row.is_kidnapping_for_ransom === 'yes' || row.is_kidnapping_for_ransom == 1,
                authors: authorName,
                correspondingAuthor: `${row.prefix || ''} ${row.firstname || ''} ${row.lastname || ''}`.trim(),
                correspondingEmail: row.corresponding_email,
                authorEmail: row.author_email,
                orcidId: row.orcid_id,
                affiliations: row.affiliations,
                reviewerInvitations: {
                    accepted: row.accepted_reviewers || 0,
                    declined: row.declined_reviewers || 0,
                    pending: row.pending_reviewers || 0,
                },
                editorInvitations: {
                    accepted: row.accepted_editors || 0,
                    declined: row.declined_editors || 0,
                    pending: row.pending_editors || 0,
                },
                newReviews: row.new_reviews || 0,
                files,
            };
        });

        return res.json({
            success: true,
            submissions: formattedSubmissions,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit,
        });
    } catch (error) {
        console.error("Error in mySubmissions:", error);
        return res.status(500).json({ success: false, error: "Server error", message: error.message });
    }
};

module.exports = mySubmissions;