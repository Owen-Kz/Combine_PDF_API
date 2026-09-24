// backend/controllers/editors/mySubmissions.js
const db = require("../../routes/db.config");

const normalizeTitle = (t) =>
  String(t || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// ─────────────────────────────────────────────────────────────────────────────
// Family map — cached, rebuilt every 5 min or on demand.
// Union-find over (article_id, previous_manuscript_id, normalized title).
// ─────────────────────────────────────────────────────────────────────────────
let familyCache = null;
let familyCacheBuiltAt = 0;
const FAMILY_CACHE_TTL_MS = 5 * 60 * 1000;

async function buildFamilyMap() {
  const [rows] = await db.promise().query(`
    SELECT article_id, revision_id, previous_manuscript_id, title
      FROM submissions
     WHERE title != '' AND title != 'Draft Submission'
  `);

  const byArticle = new Map();
  const byRevision = new Map();
  for (const r of rows) {
    byArticle.set(r.article_id, r);
    if (r.revision_id) byRevision.set(r.revision_id, r);
  }

  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    // Path compression
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur);
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  // Pass 1: chain via previous_manuscript_id
  for (const r of rows) {
    if (!parent.has(r.article_id)) parent.set(r.article_id, r.article_id);
    if (!r.previous_manuscript_id) continue;

    const parentRow =
      byArticle.get(r.previous_manuscript_id) ||
      byRevision.get(r.previous_manuscript_id);
    if (parentRow) union(r.article_id, parentRow.article_id);
  }

  // Pass 2: merge by normalized title
  const byTitle = new Map();
  for (const r of rows) {
    const norm = normalizeTitle(r.title);
    if (!norm) continue;
    if (!byTitle.has(norm)) byTitle.set(norm, []);
    byTitle.get(norm).push(r.article_id);
  }
  for (const [/* norm */, articleIds] of byTitle) {
    if (articleIds.length < 2) continue;
    for (let i = 1; i < articleIds.length; i++) {
      union(articleIds[0], articleIds[i]);
    }
  }

  // Group members by root, then pick smallest article_id as family_id
  const groups = new Map();
  for (const r of rows) {
    const root = find(r.article_id);
    if (!groups.has(root)) groups.set(root, new Set());
    groups.get(root).add(r.article_id);
  }

  const map = new Map();
  const familyMembers = new Map(); // family_id → Set<article_id>
  for (const [, members] of groups) {
    const familyId = [...members].sort()[0];
    const memberSet = new Set(members);
    familyMembers.set(familyId, memberSet);
    for (const aid of members) map.set(aid, familyId);
  }

  familyCache = { map, familyMembers };
  familyCacheBuiltAt = Date.now();
}

async function getFamilyCache() {
  if (!familyCache || Date.now() - familyCacheBuiltAt > FAMILY_CACHE_TTL_MS) {
    await buildFamilyMap();
  }
  return familyCache;
}

function invalidateFamilyCache() {
  familyCache = null;
  familyCacheBuiltAt = 0;
}

// ─────────────────────────────────────────────────────────────────────────────

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
    const editorId = req.user?.id;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const search = (req.query.search || '').trim();
    const offset = (page - 1) * limit;

    if (!editorEmail || !editorId) {
      return res.status(400).json({ success: false, error: 'Invalid Parameters' });
    }

    // 1) Assigned article_ids for this editor
    const [assignedRows] = await db.promise().query(
      ASSIGNED_SUBQUERY, [editorEmail, editorEmail]
    );

    // 2) Load family cache
    const { map: familyMap, familyMembers } = await getFamilyCache();

    // 3) Translate each assigned article_id → its family_id
    const assignedFamilySet = new Set();
    for (const r of assignedRows) {
      const fid = familyMap.get(r.article_id) || r.article_id;
      assignedFamilySet.add(fid);
    }
    let familyIds = [...assignedFamilySet];

    // 4) Optional search — narrow families whose *members* match
    if (search.length >= 2) {
      const pattern = `%${search}%`;

      // All article_ids across all assigned families (for IN expansion)
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
                 s.title       LIKE ?
              OR s.article_id  LIKE ?
              OR s.revision_id LIKE ?
              OR s.status      LIKE ?
              OR a.firstname   LIKE ?
              OR a.lastname    LIKE ?
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

    const total = familyIds.length;
    if (total === 0) {
      return res.json({
        success: true, submissions: [], total: 0,
        totalPages: 0, currentPage: page, limit,
      });
    }

    // 5) Sort family_ids DESC and paginate
    familyIds.sort().reverse();
    const pagedFamilyIds = familyIds.slice(offset, offset + limit);

    // 6) Gather ALL article_ids that belong to the paged families
    const pageMemberIds = [];
    for (const fid of pagedFamilyIds) {
      const members = familyMembers.get(fid);
      if (members) pageMemberIds.push(...members);
    }

    if (pageMemberIds.length === 0) {
      return res.json({
        success: true, submissions: [], total,
        totalPages: Math.ceil(total / limit), currentPage: page, limit,
      });
    }

    // 7) Fetch every submission row for those article_ids
    const [allSubmissions] = await db.promise().query(
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
      WHERE s.article_id IN (?)
        AND s.title != '' AND s.title != 'Draft Submission'`,
      [editorEmail, pageMemberIds]
    );

    // 8) Deduplicate: one representative row per family (the highest id)
    const repByFamily = new Map();
    for (const row of allSubmissions) {
      const fid = familyMap.get(row.article_id) || row.article_id;
      const existing = repByFamily.get(fid);
      if (!existing || row.id > existing.id) {
        repByFamily.set(fid, row);
      }
    }

    const representatives = [...repByFamily.entries()]
      .map(([fid, row]) => ({ fid, row }))
      .sort((a, b) => (a.fid < b.fid ? 1 : -1)) // family_id DESC
      .map(({ row }) => row);

    // 9) Format
    const formattedSubmissions = representatives.map((row) => {
      const fid = familyMap.get(row.article_id) || row.article_id;
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
        date: (row.process_start_date || row.date_submitted)
          ? new Date(row.process_start_date || row.date_submitted).toLocaleDateString('en-GB', {
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
    console.error('Error in mySubmissions:', error);
    return res.status(500).json({ success: false, error: 'Server error', message: error.message });
  }
};

module.exports = mySubmissions;
module.exports.invalidateFamilyCache = invalidateFamilyCache;