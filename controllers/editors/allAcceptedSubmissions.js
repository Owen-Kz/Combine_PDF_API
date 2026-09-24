// backend/controllers/editors/allAcceptedSubmissions.js
const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");
const {
  getFamilyCache,
  resolveToFamilyIds,
  getFamilyArticleIds,
} = require("./familyMap");

const DECISION_STATUSES = [
  "accepted",
  "rejected",
  "returned_for_correction",
  "returned_for_revision",
];
const DECISION_IN_SQL = DECISION_STATUSES.map((s) => `'${s}'`).join(",");

const allAcceptedSubmissions = async (req, res) => {
  try {
    const userId = req.user?.email;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const search = (req.body?.search || "").trim();
    const decision = req.body?.decision || "all";
    const type = req.body?.type || "all";
    const offset = (page - 1) * limit;

    if (!userId) {
      return res.status(400).json({ error: "Invalid Parameters" });
    }
    if (!(await isAdminAccount(userId))) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { map: familyMap, familyMembers } = await getFamilyCache();

    // ─────────────────────────────────────────────────────────────────────
    // Base WHERE — the same across list, count, stats, types.
    // ─────────────────────────────────────────────────────────────────────
    const baseWhere = `
      s.title != ''
      AND s.title != 'Draft Submission'
      AND LOWER(s.status) IN (${DECISION_IN_SQL})
    `;

    // Optional filter fragments (search, decision, type)
    const filterFrags = [];
    const filterParams = [];

    if (search.length >= 2) {
      filterFrags.push(`
        AND (
             s.title        LIKE ?
          OR s.article_id   LIKE ?
          OR s.revision_id  LIKE ?
          OR LOWER(s.status) LIKE ?
          OR a.firstname    LIKE ?
          OR a.lastname     LIKE ?
        )
      `);
      const p = `%${search}%`;
      const ps = `%${search.toLowerCase()}%`;
      filterParams.push(p, p, p, ps, p, p);
    }
    if (decision !== "all") {
      filterFrags.push(` AND LOWER(s.status) = ?`);
      filterParams.push(decision.toLowerCase());
    }
    if (type !== "all") {
      filterFrags.push(` AND s.article_type = ?`);
      filterParams.push(type);
    }

    const filterClause = filterFrags.join("");

    // ─────────────────────────────────────────────────────────────────────
    // 1) Find the article_ids that match the base + filters. Then resolve
    //    to families. Stats query uses a separate scan.
    // ─────────────────────────────────────────────────────────────────────
    const [matchingArticleRows] = await db.promise().query(
      `SELECT DISTINCT s.article_id
         FROM submissions s
         LEFT JOIN authors_account a ON s.corresponding_authors_email = a.email
        WHERE ${baseWhere}
          ${filterClause}`,
      filterParams
    );

    let familyIds = [
      ...resolveToFamilyIds(
        matchingArticleRows.map((r) => r.article_id),
        familyMap
      ),
    ];

    const total = familyIds.length;
    if (total === 0) {
      return res.json({
        success: "Admin Account",
        submissions: [],
        total: 0,
        totalPages: 0,
        currentPage: page,
        limit,
        decisionStats: {
          accepted: 0,
          rejected: 0,
          returned_for_correction: 0,
          returned_for_revision: 0,
        },
        articleTypes: [],
        filters: { decision, type, search },
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2) Paginate families and gather all article_ids for the page.
    // ─────────────────────────────────────────────────────────────────────
    familyIds.sort().reverse();
    const pagedFamilyIds = familyIds.slice(offset, offset + limit);

    const pagedArticleIds = [];
    for (const fid of pagedFamilyIds) {
      pagedArticleIds.push(...getFamilyArticleIds(fid, familyMembers));
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3) Fetch all submissions in the paged families, then take the latest
    //    row per family.
    // ─────────────────────────────────────────────────────────────────────
    const [allRows] = await db.promise().query(
      `SELECT
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
         s.is_kidnapping_for_ransom         AS is_kidnapping_for_ransom,
         s.is_belispoint_academic           AS is_belispoint_academic,
         s.previous_manuscript_id           AS previous_manuscript_id,
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
        AND ${baseWhere}`,
      [pagedArticleIds]
    );

    const repByFamily = new Map();
    for (const row of allRows) {
      const fid = familyMap.get(row.article_id) || row.article_id;
      const existing = repByFamily.get(fid);
      if (!existing || row.id > existing.id) {
        repByFamily.set(fid, row);
      }
    }
    const submissions = pagedFamilyIds
      .map((fid) => repByFamily.get(fid))
      .filter(Boolean);

    // ─────────────────────────────────────────────────────────────────────
    // 4) Stats + types (parallel, independent of pagination)
    // ─────────────────────────────────────────────────────────────────────
    const [[statsRows], [typesRows]] = await Promise.all([
      db.promise().query(
        `SELECT DISTINCT s.article_id, LOWER(s.status) AS decision
           FROM submissions s
          WHERE ${baseWhere}`
      ),
      db.promise().query(
        `SELECT DISTINCT s.article_type AS type
           FROM submissions s
          WHERE ${baseWhere}
            AND s.article_type IS NOT NULL
            AND s.article_type != ''
          ORDER BY s.article_type ASC`
      ),
    ]);

    // Count distinct families per decision
    const decisionFamilySets = new Map();
    for (const r of statsRows) {
      const fid = familyMap.get(r.article_id) || r.article_id;
      if (!decisionFamilySets.has(r.decision)) decisionFamilySets.set(r.decision, new Set());
      decisionFamilySets.get(r.decision).add(fid);
    }
    const decisionStats = {
      accepted: 0,
      rejected: 0,
      returned_for_correction: 0,
      returned_for_revision: 0,
    };
    for (const [status, set] of decisionFamilySets) {
      if (decisionStats[status] !== undefined) decisionStats[status] = set.size;
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5) Format
    // ─────────────────────────────────────────────────────────────────────
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

      const normalizedStatus = String(row.status || "").toLowerCase();
      if (normalizedStatus === "accepted") {
        files.decision_letter = `acceptance_letter_${row.article_id}.pdf`;
      } else if (normalizedStatus === "rejected") {
        files.decision_letter = `rejection_letter_${row.article_id}.pdf`;
      }

      return {
        id: fid,
        family_id: fid,
        article_id: row.article_id,
        revision_id: row.revision_id,
        revisions_count: row.revisions_count,
        corrections_count: row.corrections_count,
        previous_manuscript_id: row.previous_manuscript_id,
        title: row.title,
        abstract: row.abstract,
        type: row.article_type || "Research Article",
        discipline: row.discipline,
        decision: normalizedStatus,
        status: row.status,
        date: row.date_submitted
          ? new Date(row.date_submitted).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "N/A",
        submittedDate: row.date_submitted,
        decisionDate: row.process_start_date
          ? new Date(row.process_start_date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "N/A",
        updatedAt: row.last_updated,
        isWomenInScience: row.is_women_in_science === "yes" || row.is_women_in_science == 1,
        isBelispointAcademic: row.is_belispoint_academic === "yes" || row.is_belispoint_academic == 1,
        isKidnappingForRansom: row.is_kidnapping_for_ransom === "yes" || row.is_kidnapping_for_ransom == 1,
        authors: [authorName],
        correspondingAuthor,
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
        files,
        decisionMaker: "Editor",
        decisionMakerEmail: userId,
        decisionNotes: `This manuscript has been ${normalizedStatus} for publication.`,
        keywords: [],
      };
    });

    return res.json({
      success: "Admin Account",
      submissions: formattedSubmissions,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      limit,
      decisionStats,
      articleTypes: typesRows.map((r) => r.type),
      filters: { decision, type, search },
    });
  } catch (error) {
    console.error("Error in allAcceptedSubmissions:", error);
    return res.status(500).json({ error: "Server error", message: error.message });
  }
};

module.exports = allAcceptedSubmissions;