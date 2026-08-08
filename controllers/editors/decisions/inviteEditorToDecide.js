const mysql = require("mysql2/promise");
const Brevo = require("@getbrevo/brevo");
const dotenv = require("dotenv");
dotenv.config();

const dbConfig = {
  host: process.env.D_HOST,
  user: process.env.D_USER,
  password: process.env.D_PASSWORD,
  database: process.env.D_NAME,
};

const inviteEditorToDecide = async (req, res) => {
  let connection;
  try {
    const { articleId, editorEmail } = req.body;
    const requester = req.user?.email || "";

    if (!requester) {
      return res.status(401).json({ status: "error", message: "Authentication required" });
    }
    if (!articleId || !editorEmail) {
      return res.status(400).json({ status: "error", message: "articleId and editorEmail are required" });
    }

    connection = await mysql.createConnection(dbConfig);

    const [requesterRows] = await connection.execute(
      "SELECT email FROM editors WHERE email = ? AND (editorial_level IN (?, ?, ?))",
      [requester, "editor_in_chief", "admin", "editorial_assistant"]
    );
    if (requesterRows.length === 0) {
      return res.status(403).json({ status: "error", message: "Only Editor-in-Chief or Admin can invite editors for decision" });
    }

    const [submission] = await connection.execute(
      "SELECT id, revision_id, title, status FROM submissions WHERE revision_id = ?",
      [articleId]
    );
    if (submission.length === 0) {
      return res.status(404).json({ status: "error", message: "Submission not found" });
    }

    const [allReviews] = await connection.execute(
      "SELECT COUNT(*) AS total FROM reviews WHERE article_id = ? AND review_status = 'review_submitted'",
      [articleId]
    );
    const [invitedReviewers] = await connection.execute(
      "SELECT COUNT(*) AS total FROM invitations WHERE invitation_link = ? AND invited_for = 'Submission Review' AND invitation_status IN ('accepted', 'completed', 'review_saved', 'review_submitted')",
      [articleId]
    );

    if (allReviews[0].total === 0) {
      return res.status(400).json({ status: "error", message: "No reviews have been submitted for this manuscript yet" });
    }

    const [existingInvitation] = await connection.execute(
      "SELECT 1 FROM invitations WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'To Decide' AND invitation_status IN ('pending', 'invite_sent')",
      [articleId, editorEmail]
    );
    if (existingInvitation.length > 0) {
      return res.status(200).json({ status: "warning", message: "Decision invitation already sent to this editor" });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const decisionLink = `${frontendUrl}/editors/decision/${articleId}`;

    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #501f46;">Decision Required</h2>
        <p>Dear Editor,</p>
        <p>A manuscript is awaiting your editorial decision:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Manuscript ID</td><td style="padding: 8px; border: 1px solid #ddd;">${submission[0].revision_id}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Title</td><td style="padding: 8px; border: 1px solid #ddd;">${submission[0].title || "N/A"}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reviews Submitted</td><td style="padding: 8px; border: 1px solid #ddd;">${allReviews[0].total}</td></tr>
        </table>
        <p>Please review the manuscript and reviewer reports, then make your decision.</p>
        <p style="text-align: center;">
          <a href="${decisionLink}" style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Review &amp; Make Decision</a>
        </p>
        <p>You can also log into your dashboard to access the manuscript details and all reviewer reports.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 0.85em; color: #666;">ASFI Research Journal Editorial System</p>
      </body>
      </html>
    `;

    const emailData = {
      sender: { email: process.env.BREVO_EMAIL, name: "ASFI Research Journal" },
      to: [{ email: editorEmail }],
      subject: `Decision Required: ${submission[0].revision_id} - ${submission[0].title || "Manuscript"}`,
      htmlContent: htmlContent,
    };

    await apiInstance.sendTransacEmail(emailData);

    await connection.execute(
      "INSERT INTO sent_emails (article_id, sender, recipient, subject, status, body, sent_at, email_for) VALUES (?, ?, ?, ?, 'Delivered', ?, NOW(), 'invite_editor_decision')",
      [articleId, requester, editorEmail, emailData.subject, htmlContent]
    );

    const [editorNameRows] = await connection.execute(
      "SELECT email, fullname FROM editors WHERE email = ? LIMIT 1",
      [editorEmail]
    );
    const invitedUserName = editorNameRows.length > 0
      ? (editorNameRows[0].fullname || editorEmail)
      : editorEmail;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 14);
    await connection.execute(
      "INSERT INTO invitations (invitation_link, invited_user, invited_user_name, invitation_status, invitation_expiry_date, invited_for) VALUES (?, ?, ?, 'pending', ?, 'To Decide')",
      [articleId, editorEmail, invitedUserName, expiryDate.toISOString().split("T")[0]]
    );

    await connection.execute(
      "UPDATE submissions SET status = 'under_editor_decision' WHERE revision_id = ?",
      [articleId]
    );

    return res.json({ status: "success", message: "Editor invited for decision successfully" });
  } catch (error) {
    console.error("Error inviting editor for decision:", error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  } finally {
    if (connection) await connection.end();
  }
};

module.exports = inviteEditorToDecide;
