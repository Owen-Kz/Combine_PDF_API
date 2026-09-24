// controllers/authors/getRelatedSubmissions.js
const db = require("../../routes/db.config");
const {
  getFamilyCache,
  getFamilyArticleIds,
} = require("../editors/familyMap");

const getRelatedSubmissions = async (req, res) => {
  try {
    const userEmail = req.user?.email;
    const { id } = req.params;

    if (!userEmail || !id) {
      return res.status(400).json({ status: "error", message: "Invalid Parameters" });
    }

    // ────────────────────────────────────────────────────────────────────────
    // 1) Resolve the seed row from any identifier the caller provided
    //    (revision_id, article_id, or the numeric id).
    // ────────────────────────────────────────────────────────────────────────
    const [seedRows] = await db.promise().query(
      `SELECT id, article_id, revision_id, previous_manuscript_id, title
         FROM submissions
        WHERE revision_id = ?
           OR article_id = ?
           OR id = ?
        ORDER BY (revision_id = ?) DESC, id DESC
        LIMIT 1`,
      [id, id, id, id]
    );

    if (seedRows.length === 0) {
      return res.json({
        status: "success",
        submissions: [],
        message: "No submissions found",
      });
    }

    const seed = seedRows[0];

    // ────────────────────────────────────────────────────────────────────────
    // 2) Look up the seed's family via the cached family map. This is the
    //    same union-find result used by every other controller, so the family
    //    here is guaranteed to be identical to what the editor/admin sees.
    // ────────────────────────────────────────────────────────────────────────
    const { map: familyMap, familyMembers } = await getFamilyCache();

    const familyId = familyMap.get(seed.article_id) || seed.article_id;
    const familyArticleIds = getFamilyArticleIds(familyId, familyMembers);

    if (familyArticleIds.length === 0) {
      return res.json({ status: "success", submissions: [] });
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3) Fetch every submission in the family, scoped to this author.
    //
    //    Scoping by email is intentionally kept — "related submissions" from
    //    the author's perspective means "my versions of this paper." The
    //    family gives us the shape; the author filter gives us the subset
    //    that actually belongs to this user.
    // ────────────────────────────────────────────────────────────────────────
    const [submissions] = await db.promise().query(
      `SELECT *
         FROM submissions
        WHERE corresponding_authors_email = ?
          AND title != ''
          AND title != 'Draft Submission'
          AND article_id IN (?)
        ORDER BY process_start_date ASC, id ASC`,
      [userEmail, familyArticleIds]
    );

    if (submissions.length === 0) {
      return res.json({ status: "success", submissions: [] });
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4) Batch-fetch keywords and authors in two queries.
    //
    //    The schema uses `submission_keywords.article_id` to mean the
    //    submission's revision_id, so we key by revision_id here. Same for
    //    submission_authors.submission_id — this endpoint's existing
    //    contract expects revision_id there. (If that ever changes, adjust
    //    both sides consistently.)
    // ────────────────────────────────────────────────────────────────────────
    const submissionKeys = submissions.map((s) => s.revision_id || s.id);

    const [[allKeywords], [allAuthors]] = await Promise.all([
      db.promise().query(
        `SELECT article_id, keyword
           FROM submission_keywords
          WHERE article_id IN (?)
          ORDER BY id ASC`,
        [submissionKeys]
      ),
      db.promise().query(
        `SELECT submission_id,
                authors_fullname AS name,
                authors_email    AS email
           FROM submission_authors
          WHERE submission_id IN (?)`,
        [submissionKeys]
      ),
    ]);

    // Group results by key for O(1) lookup per submission.
    const keywordsByKey = new Map();
    for (const row of allKeywords) {
      if (!keywordsByKey.has(row.article_id)) keywordsByKey.set(row.article_id, []);
      keywordsByKey.get(row.article_id).push(row.keyword);
    }

    const authorsByKey = new Map();
    for (const row of allAuthors) {
      if (!authorsByKey.has(row.submission_id)) authorsByKey.set(row.submission_id, []);
      authorsByKey.get(row.submission_id).push({
        name: row.name,
        email: row.email,
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // 5) Shape the response — same contract as before, plus family_id.
    // ────────────────────────────────────────────────────────────────────────
    const submissionsWithDetails = submissions.map((submission) => {
      const key = submission.revision_id || submission.id;
      return {
        ...submission,
        family_id: familyMap.get(submission.article_id) || submission.article_id,
        keywords: keywordsByKey.get(key) || [],
        authors_list: authorsByKey.get(key) || [],
      };
    });

    return res.json({
      status: "success",
      submissions: submissionsWithDetails,
    });
  } catch (error) {
    console.error("Error fetching related submissions:", error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
};

module.exports = getRelatedSubmissions;