// controllers/authors/getRelatedSubmissions.js
const db = require("../../routes/db.config");

// Normalize a title for comparison in JS. Must mirror the SQL normalization
// exactly: lowercase, strip everything but a-z0-9 and spaces, collapse
// whitespace, trim.
const normalizeTitle = (title) =>
  (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getRelatedSubmissions = async (req, res) => {
  try {
    const userEmail = req.user?.email;
    const { id } = req.params;

    if (!userEmail || !id) {
      return res.status(400).json({ status: "error", message: "Invalid Parameters" });
    }

    // ────────────────────────────────────────────────────────────────────────
    // 1) Locate the seed row from ANY identifier the caller might have passed.
    //    A submission can be addressed by revision_id, article_id, or id —
    //    handling all three here means the endpoint works uniformly whether
    //    the caller has the revision ID (usual) or a base article ID.
    // ────────────────────────────────────────────────────────────────────────
    const [seedRows] = await db.promise().query(
      `SELECT id, article_id, revision_id, previous_manuscript_id, title
         FROM submissions
        WHERE revision_id = ?
           OR article_id = ?
           OR id = ?
           OR previous_manuscript_id = ?
        ORDER BY (revision_id = ?) DESC, id DESC
        LIMIT 1`,
      [id, id, id, id, id]
    );

    if (seedRows.length === 0) {
      return res.json({ status: "success", submissions: [], message: "No submissions found" });
    }

    const seed = seedRows[0];

    // ────────────────────────────────────────────────────────────────────────
    // 2) Resolve the family's base article_id. If the seed is itself a revision
    //    (has a previous_manuscript_id), find its parent; otherwise use its own
    //    article_id.
    // ────────────────────────────────────────────────────────────────────────
    let baseArticleId = seed.article_id;

    if (seed.previous_manuscript_id) {
      const [parentRows] = await db.promise().query(
        `SELECT article_id FROM submissions
          WHERE revision_id = ? OR article_id = ?
          LIMIT 1`,
        [seed.previous_manuscript_id, seed.previous_manuscript_id]
      );
      if (parentRows.length > 0 && parentRows[0].article_id) {
        baseArticleId = parentRows[0].article_id;
      }
    }

    // Normalized title for the punctuation/whitespace-tolerant match.
    const normalizedSeedTitle = normalizeTitle(seed.title);

    // ────────────────────────────────────────────────────────────────────────
    // 3) Fetch every submission in the family, scoped to this author.
    //    Match conditions (OR'd):
    //      - same article_id
    //      - previous_manuscript_id points at the base article_id (revisions)
    //      - base article_id points at this row (parent of the seed)
    //      - normalized title equality (catches "Nigeria." vs "Nigeria")
    // ────────────────────────────────────────────────────────────────────────
    const [submissions] = await db.promise().query(
      `SELECT *
         FROM submissions
        WHERE corresponding_authors_email = ?
          AND title != ''
          AND title != 'Draft Submission'
          AND (
               article_id = ?
            OR previous_manuscript_id = ?
            OR ? = revision_id
            OR REGEXP_REPLACE(
                 REGEXP_REPLACE(LOWER(title), '[^a-z0-9 ]+', ''),
                 ' +', ' '
               ) = ?
          )
        ORDER BY process_start_date ASC, id ASC`,
      [userEmail, baseArticleId, baseArticleId, baseArticleId, normalizedSeedTitle]
    );

    if (submissions.length === 0) {
      return res.json({ status: "success", submissions: [] });
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4) Batch-fetch keywords and authors for ALL related submissions in
    //    two queries instead of 2N. Previously: 1 query per submission per
    //    table (2N round trips). Now: 2 round trips total.
    // ────────────────────────────────────────────────────────────────────────
    const submissionKeys = submissions.map((s) => s.revision_id || s.id);

    const [allKeywords, allAuthors] = await Promise.all([
      db.promise().query(
        `SELECT article_id, keyword
           FROM submission_keywords
          WHERE article_id IN (?)
          ORDER BY id ASC`,
        [submissionKeys]
      ).then(([rows]) => rows),

      db.promise().query(
        `SELECT submission_id,
                authors_fullname AS name,
                authors_email    AS email
           FROM submission_authors
          WHERE submission_id IN (?)`,
        [submissionKeys]
      ).then(([rows]) => rows),
    ]);

    // Group keywords and authors by submission key so the map below is O(n).
    const keywordsByKey = allKeywords.reduce((acc, row) => {
      (acc[row.article_id] = acc[row.article_id] || []).push(row.keyword);
      return acc;
    }, {});

    const authorsByKey = allAuthors.reduce((acc, row) => {
      (acc[row.submission_id] = acc[row.submission_id] || []).push({
        name: row.name,
        email: row.email,
      });
      return acc;
    }, {});

    // ────────────────────────────────────────────────────────────────────────
    // 5) Shape the response the same way the previous version did.
    // ────────────────────────────────────────────────────────────────────────
    const submissionsWithDetails = submissions.map((submission) => {
      const key = submission.revision_id || submission.id;
      return {
        ...submission,
        keywords: keywordsByKey[key] || [],
        authors_list: authorsByKey[key] || [],
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