const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

const dbConfig = {
  host: process.env.D_HOST,
  user: process.env.D_USER,
  password: process.env.D_PASSWORD,
  database: process.env.D_NAME,
};

const getDecisionData = async (req, res) => {
  let connection;
  try {
    const { articleId } = req.params;
    const editorEmail = req.user?.email || "";

    if (!editorEmail) {
      return res.status(401).json({ status: "error", message: "Authentication required" });
    }
    if (!articleId) {
      return res.status(400).json({ status: "error", message: "Article ID is required" });
    }

    connection = await mysql.createConnection(dbConfig);

    const [invitation] = await connection.execute(
      "SELECT 1 FROM invitations WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'To Decide'",
      [articleId, editorEmail]
    );
    if (invitation.length === 0) {
      return res.status(403).json({ status: "error", message: "You are not authorized to access this manuscript" });
    }

    const [submissions] = await connection.execute(
      `SELECT 
        s.id, s.revision_id, s.title, s.abstract, s.article_type, s.discipline,
        s.status, s.date_submitted, s.process_start_date, s.last_updated,
        s.manuscript_file, s.document_file, s.tracked_manuscript_file,
        s.cover_letter_file, s.tables, s.figures, s.graphic_abstract,
        s.supplementary_material, s.corresponding_authors_email,
        s.handled_by, s.revisions_count, s.corrections_count,
        s.previous_manuscript_id, s.is_women_in_contemporary_science,
        s.is_kidnapping_for_ransom, s.is_belispoint_academic
      FROM submissions s
      WHERE s.revision_id = ?`,
      [articleId]
    );

    if (submissions.length === 0) {
      return res.status(404).json({ status: "error", message: "Submission not found" });
    }

    const [reviews] = await connection.execute(
      `SELECT 
        r.*,
        CONCAT_WS(' ', a.prefix, a.firstname, a.lastname) AS reviewer_name,
        a.orcid_id, a.affiliations, a.affiliation_country, a.affiliation_city
      FROM reviews r
      LEFT JOIN authors_account a ON r.reviewer_email = a.email
      WHERE r.article_id = ? AND r.review_status = 'review_submitted'
      ORDER BY r.id ASC`,
      [articleId]
    );

    const [authors] = await connection.execute(
      `SELECT sa.*, aa.firstname, aa.lastname, aa.affiliations, aa.email
      FROM submission_authors sa
      LEFT JOIN authors_account aa ON sa.authors_email = aa.email
      WHERE sa.submission_id = ?
      ORDER BY sa.author_order ASC`,
      [submissions[0].id]
    );

    const [keywords] = await connection.execute(
      `SELECT keyword FROM submission_keywords WHERE submission_id = ?`,
      [submissions[0].id]
    );

    return res.json({
      status: "success",
      data: {
        submission: submissions[0],
        reviews: reviews.map(r => ({
          ...r,
          reviewer_name: r.reviewer_name?.trim() || r.reviewer_email?.split('@')[0] || 'Anonymous'
        })),
        authors,
        keywords: keywords.map(k => k.keyword),
      }
    });
  } catch (error) {
    console.error("Error fetching decision data:", error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  } finally {
    if (connection) await connection.end();
  }
};

module.exports = getDecisionData;
