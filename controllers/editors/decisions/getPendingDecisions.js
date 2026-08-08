const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

const dbConfig = {
  host: process.env.D_HOST,
  user: process.env.D_USER,
  password: process.env.D_PASSWORD,
  database: process.env.D_NAME,
};

const getPendingDecisions = async (req, res) => {
  let connection;
  try {
    const editorEmail = req.user?.email || "";
    if (!editorEmail) {
      return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    connection = await mysql.createConnection(dbConfig);

    const [editorRows] = await connection.execute(
      "SELECT email, fullname, editorial_level FROM editors WHERE email = ?",
      [editorEmail]
    );
    if (editorRows.length === 0) {
      return res.status(403).json({ status: "error", message: "Editor account not found" });
    }

    const query = `
      SELECT 
        s.id,
        s.revision_id,
        s.title,
        s.article_type,
        s.date_submitted,
        s.status,
        i.invitation_status,
        i.invitation_date,
        i.invitation_expiry_date,
        i.invited_user,
        i.decision_viewed,
        (SELECT COUNT(*) FROM reviews r WHERE r.article_id = s.revision_id AND r.review_status = 'review_submitted') AS reviews_count,
        (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = s.revision_id AND inv.invited_for = 'Submission Review' AND inv.invitation_status IN ('accepted', 'completed', 'review_saved', 'review_submitted')) AS expected_reviews
      FROM invitations i
      INNER JOIN submissions s ON s.revision_id = i.invitation_link
        AND s.id = (SELECT MIN(id) FROM submissions WHERE revision_id = i.invitation_link)
      WHERE i.invited_user = ?
        AND i.invited_for = 'To Decide'
        AND i.invitation_status IN ('pending', 'invite_sent')
      ORDER BY i.id DESC
    `;
    const [pending] = await connection.execute(query, [editorEmail]);

    return res.json({ status: "success", data: pending });
  } catch (error) {
    console.error("Error fetching pending decisions:", error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  } finally {
    if (connection) await connection.end();
  }
};

module.exports = getPendingDecisions;
