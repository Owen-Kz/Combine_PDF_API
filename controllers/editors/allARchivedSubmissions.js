// backend/controllers/editors/ArchivedSubmissions.js
const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");
const {
  getFamilyCacheForTable,
  resolveToFamilyIds,
  getFamilyArticleIds,
} = require("./familyMap");

const TABLE = "archived_submissions";

const ArchivedSubmissions = async (req, res) => {
  try {
    const userId = req.user?.email;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const search = (req.query.search || "").trim();
    const offset = (page - 1) * limit;

    if (!userId) return res.status(400).json({ error: "Invalid Parameters" });
    if (!(await isAdminAccount(userId))) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { map: familyMap, familyMembers } = await getFamilyCacheForTable(TABLE);

    // Assigned = every article_id in the table
    const [allArticleRows] = await db.promise().query(`
      SELECT DISTINCT article_id FROM \`${TABLE}\`
       WHERE title != '' AND title != 'Draft Submission'
    `);
    let familyIds = [...resolveToFamilyIds(allArticleRows.map((r) => r.article_id), familyMap)];

    if (search.length >= 2) {
      const p = `%${search}%`;
      const [matches] = await db.promise().query(
        `SELECT DISTINCT s.article_id
           FROM \`${TABLE}\` s
           LEFT JOIN authors_account a ON s.corresponding_authors_email = a.email
          WHERE s.title != '' AND s.title != 'Draft Submission'
            AND (
                 s.title       LIKE ?
              OR s.article_id  LIKE ?
              OR s.revision_id LIKE ?
              OR s.status      LIKE ?
              OR a.firstname   LIKE ?
              OR a.lastname    LIKE ?
            )`,
        [p, p, p, p, p, p]
      );
      const matched = resolveToFamilyIds(matches.map((m) => m.article_id), familyMap);
      familyIds = familyIds.filter((fid) => matched.has(fid));
    }

    const total = familyIds.length;
    if (total === 0) {
      return res.json({
        success: true, submissions: [], total: 0,
        totalPages: 0, currentPage: page, limit,
      });
    }

    familyIds.sort().reverse();
    const pagedFamilyIds = familyIds.slice(offset, offset + limit);
    const pagedArticleIds = [];
    for (const fid of pagedFamilyIds) {
      pagedArticleIds.push(...getFamilyArticleIds(fid, familyMembers));
    }

    const [rows] = await db.promise().query(
      `SELECT
         s.id, s.article_id, s.revision_id,
         s.revisions_count, s.corrections_count,
         s.title, s.abstract, s.article_type, s.discipline, s.status,
         s.date_submitted, s.process_start_date, s.last_updated,
         s.is_women_in_contemporary_science AS is_women_in_science,
         s.is_kidnapping_for_ransom         AS is_kidnapping_for_ransom,
         s.is_belispoint_academic           AS is_belispoint_academic,
         s.previous_manuscript_id           AS previous_manuscript_id,
         s.corresponding_authors_email      AS corresponding_email,
         s.manuscript_file, s.document_file, s.tracked_manuscript_file,
         s.cover_letter_file, s.tables, s.figures,
         s.graphic_abstract, s.supplementary_material,
         a.firstname, a.lastname, a.email AS author_email,
         a.orcid_id, a.affiliations, a.prefix,
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
       FROM \`${TABLE}\` s
       LEFT JOIN authors_account a ON s.corresponding_authors_email = a.email
      WHERE s.article_id IN (?)
        AND s.title != '' AND s.title != 'Draft Submission'`,
      [pagedArticleIds]
    );

    // One row per family (latest by id)
    const repByFamily = new Map();
    for (const row of rows) {
      const fid = familyMap.get(row.article_id) || row.article_id;
      const existing = repByFamily.get(fid);
      if (!existing || row.id > existing.id) repByFamily.set(fid, row);
    }
    const submissions = pagedFamilyIds.map((fid) => repByFamily.get(fid)).filter(Boolean);

    const formattedSubmissions = submissions.map((row) => {
      const fid = familyMap.get(row.article_id) || row.article_id;
      const authorParts = [row.prefix, row.firstname, row.lastname].filter(Boolean);
      const authorName = authorParts.join(" ") || "Unknown";
      const correspondingAuthor =
        authorParts.length > 0
          ? authorParts.join(" ")
          : row.corresponding_email?.split("@")[0] || "Unknown";

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
        id: fid, family_id: fid, article_id: row.article_id, revision_id: row.revision_id,
        revisions_count: row.revisions_count, corrections_count: row.corrections_count,
        previous_manuscript_id: row.previous_manuscript_id,
        title: row.title, abstract: row.abstract, type: row.article_type,
        discipline: row.discipline, status: row.status,
        date: row.date_submitted
          ? new Date(row.date_submitted).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          : "N/A",
        submittedDate: row.date_submitted, updatedAt: row.last_updated,
        isWomenInScience: row.is_women_in_science === "yes" || row.is_women_in_science == 1,
        isBelispointAcademic: row.is_belispoint_academic === "yes" || row.is_belispoint_academic == 1,
        isKidnappingForRansom: row.is_kidnapping_for_ransom === "yes" || row.is_kidnapping_for_ransom == 1,
        authors: authorName, correspondingAuthor,
        correspondingEmail: row.corresponding_email, authorEmail: row.author_email,
        orcidId: row.orcid_id, affiliations: row.affiliations,
        reviewerInvitations: {
          accepted: row.accepted_reviewers || 0, declined: row.declined_reviewers || 0,
          pending: row.pending_reviewers || 0,
        },
        editorInvitations: {
          accepted: row.accepted_editors || 0, declined: row.declined_editors || 0,
          pending: row.pending_editors || 0,
        },
        files,
      };
    });

    return res.json({
      success: true, submissions: formattedSubmissions, total,
      totalPages: Math.ceil(total / limit), currentPage: page, limit,
    });
  } catch (error) {
    console.error("Error in ArchivedSubmissions:", error);
    return res.status(500).json({ error: "Server error", message: error.message });
  }
};

module.exports = ArchivedSubmissions;