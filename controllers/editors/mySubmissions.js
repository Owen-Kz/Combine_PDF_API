// backend/controllers/editors/mySubmissions.js
const db = require("../../routes/db.config");
const {
  getFamilyCache,
} = require("./familyMap");

const truthy = (v) =>
  v === true || v === 1 || v === "1" || v === "true" || v === "yes";

const toISODate = (s, endOfDay = false) => {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d)) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 19).replace("T", " ");
};

const ASSIGNED_SUBQUERY = `
  SELECT DISTINCT s.article_id
    FROM submissions s
    INNER JOIN submitted_for_edit sfe
      ON (sfe.article_id = s.article_id OR sfe.article_id = s.revision_id)
   WHERE sfe.editor_email = ?
     AND sfe.status NOT IN ('declined', 'canceled', 'expired')
  UNION
  SELECT DISTINCT s.article_id
    FROM submissions s
    INNER JOIN invitations i
      ON (i.invitation_link = s.article_id OR i.invitation_link = s.revision_id)
   WHERE i.invited_user = ?
     AND i.invited_for IN ('To Edit', 'To Decide')
     AND i.invitation_status NOT IN ('declined', 'canceled', 'expired')
`;

const mySubmissions = async (req, res) => {
  try {
    const editorEmail = req.user?.email;
    const editorId    = req.user?.id;

    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const search = (req.query.search || "").trim();
    const offset = (page - 1) * limit;

    const {
      dateFrom,
      dateTo,
      status,
      type,
      isWomenInScience,
      isKidnappingForRansom,
      isBelispointAcademic,
    } = req.query;

    if (!editorEmail || !editorId) {
      return res.status(400).json({ success: false, error: "Invalid Parameters" });
    }

    // 1) Assigned article_ids
    const [assignedRows] = await db.promise().query(
      ASSIGNED_SUBQUERY, [editorEmail, editorEmail]
    );

    // 2) Family cache
    const { map: familyMap, familyMembers } = await getFamilyCache();

    // 3) Translate to family_ids
    const assignedFamilySet = new Set();
    for (const r of assignedRows) {
      const fid = familyMap.get(r.article_id) || r.article_id;
      assignedFamilySet.add(fid);
    }
    let familyIds = [...assignedFamilySet];

    // 4) Search narrow
    if (search.length >= 2) {
      const pattern = `%${search}%`;
      const memberIds = [];
      for (const fid of familyIds) {
        const members = familyMembers.get(fid);
        if (members) memberIds.push(...members);
      }
      if (memberIds.length === 0) {
        return res.json({
          success: true, submissions: [], total: 0,
          totalPages: 0, currentPage: page, limit,
        });
      }

      const [matches] = await db.promise().query(
        `SELECT DISTINCT s.article_id
           FROM submissions s
           LEFT JOIN authors_account a ON s.corresponding_authors_email = a.email
          WHERE s.article_id IN (?)
            AND s.title != '' AND s.title != 'Draft Submission'
            AND (
                 s.title        LIKE ?
              OR s.article_id   LIKE ?
              OR s.revision_id  LIKE ?
              OR s.status       LIKE ?
              OR a.firstname    LIKE ?
              OR a.lastname     LIKE ?
            )`,
        [memberIds, pattern, pattern, pattern, pattern, pattern, pattern]
      );

      const matchedFamilies = new Set();
      for (const m of matches) {
        const fid = familyMap.get(m.article_id) || m.article_id;
        matchedFamilies.add(fid);
      }
      familyIds = familyIds.filter((fid) => matchedFamilies.has(fid));
    }

    if (familyIds.length === 0) {
      return res.json({
        success: true, submissions: [], total: 0,
        totalPages: 0, currentPage: page, limit,
      });
    }

    // 5) Candidate article ids across surviving families
    const candidateArticleIds = [];
    for (const fid of familyIds) {
      const members = familyMembers.get(fid);
      if (members) candidateArticleIds.push(...members);
    }
    if (candidateArticleIds.length === 0) {
      return res.json({
        success: true, submissions: [], total: 0,
        totalPages: 0, currentPage: page, limit,
      });
    }

    // 6) Build WHERE
    const where = [
      "s.title != '' AND s.title != 'Draft Submission'",
      "s.article_id IN (?)",
    ];
    const params = [editorEmail, candidateArticleIds];

    const fromIso = toISODate(dateFrom, false);
    const toIso   = toISODate(dateTo,   true);
    if (fromIso) {
      where.push("COALESCE(s.date_submitted, s.process_start_date) >= ?");
      params.push(fromIso);
    }
    if (toIso) {
      where.push("COALESCE(s.date_submitted, s.process_start_date) <= ?");
      params.push(toIso);
    }
    if (status && status !== "all") {
      where.push("s.status = ?");
      params.push(status);
    }
    if (type && type !== "all") {
      where.push("s.article_type = ?");
      params.push(type);
    }
    if (truthy(isWomenInScience)) {
      where.push("(s.is_women_in_contemporary_science = 'yes' OR s.is_women_in_contemporary_science = 1)");
    }
    if (truthy(isKidnappingForRansom)) {
      where.push("(s.is_kidnapping_for_ransom = 'yes' OR s.is_kidnapping_for_ransom = 1)");
    }
    if (truthy(isBelispointAcademic)) {
      where.push("(s.is_belispoint_academic = 'yes' OR s.is_belispoint_academic = 1)");
    }

    const whereSql = where.join(" AND ");

    // 7) Fetch every matching row
    const [allSubmissionsRows] = await db.promise().query(
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
      WHERE ${whereSql}`,
      params
    );

    // 8) Pick the most recent row per family
    const ts = (row) => {
      const d = row.date_submitted || row.process_start_date || row.last_updated;
      const t = d ? new Date(d).getTime() : 0;
      return isNaN(t) ? 0 : t;
    };

    const repByFamily = new Map();
    for (const row of allSubmissionsRows) {
      const fid = familyMap.get(row.article_id) || row.article_id;
      const existing = repByFamily.get(fid);
      if (!existing) {
        repByFamily.set(fid, row);
        continue;
      }
      const tNew = ts(row);
      const tOld = ts(existing);
      if (tNew > tOld || (tNew === tOld && row.id > existing.id)) {
        repByFamily.set(fid, row);
      }
    }

    // 9) Sort DESC by date, tie-break by id
    const representatives = [...repByFamily.entries()]
      .map(([fid, row]) => ({ fid, row }))
      .sort((a, b) => {
        const tA = ts(a.row);
        const tB = ts(b.row);
        if (tB !== tA) return tB - tA;
        return b.row.id - a.row.id;
      });

    const total = representatives.length;
    const pageSlice = representatives.slice(offset, offset + limit);

    // 10) Format
    const formattedSubmissions = pageSlice.map(({ fid, row }) => {
      const authorParts = [row.prefix, row.firstname, row.lastname].filter(Boolean);
      const authorName = authorParts.join(" ") || "Unknown";
      const correspondingAuthor = authorParts.length > 0
        ? authorParts.join(" ")
        : (row.corresponding_email?.split("@")[0] || "Unknown");

      const files = {};
      if (row.manuscript_file)         files.manuscript = row.manuscript_file;
      if (row.document_file)           files.document = row.document_file;
      if (row.tracked_manuscript_file) files.tracked_manuscript = row.tracked_manuscript_file;
      if (row.cover_letter_file)       files.cover_letter = row.cover_letter_file;
      if (row.tables)                  files.tables = row.tables;
      if (row.figures)                 files.figures = row.figures;
      if (row.graphic_abstract)        files.graphic_abstract = row.graphic_abstract;
      if (row.supplementary_material)  files.supplementary = row.supplementary_material;

      const submittedRaw = row.date_submitted || row.process_start_date;

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
        type: row.article_type,
        discipline: row.discipline,
        status: row.status,
        date: submittedRaw
          ? new Date(submittedRaw).toLocaleDateString("en-GB", {
              day: "numeric", month: "short", year: "numeric",
            })
          : "N/A",
        submittedDate: submittedRaw,
        updatedAt: row.last_updated,
        isWomenInScience:      row.is_women_in_science === "yes" || row.is_women_in_science == 1,
        isBelispointAcademic:  row.is_belispoint_academic === "yes" || row.is_belispoint_academic == 1,
        isKidnappingForRansom: row.is_kidnapping_for_ransom === "yes" || row.is_kidnapping_for_ransom == 1,
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
    return res
      .status(500)
      .json({ success: false, error: "Server error", message: error.message });
  }
};

module.exports = mySubmissions;