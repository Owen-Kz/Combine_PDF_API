// backend/controllers/editors/email/inviteEditorEmail.js
const mysql = require("mysql2/promise");
const { ReviewerAccountEmail } = require("./revieweerAccountEmail");
const dotenv = require("dotenv");
const { escapeHtml } = require("../../utils/security");

dotenv.config();

const dbConfig = {
  host: process.env.D_HOST,
  user: process.env.D_USER,
  password: process.env.D_PASSWORD,
  database: process.env.D_NAME,
};

const inviteEditorEmail = async (req, res) => {
  let connection;
  try {
    const {
      articleId,
      reviewerEmail,
      subject,
      message,
      ccEmail,
      bccEmail,
      acceptLink,
      declineLink,
      invitationType,
      attachments: attachmentInput = [],
    } = req.body;

    const editor = req.user?.email || "";
    if (!editor) {
      return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    if (!articleId || !reviewerEmail || !subject || !message) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    // Attachments arrive as [{ url, name, size }] — already uploaded to the
    // local server via /editors/upload-invitation-attachment.
    const attachments = Array.isArray(attachmentInput)
      ? attachmentInput
          .filter((a) => a && typeof a.url === "string" && a.url.trim())
          .map((a) => ({
            url: a.url.trim(),
            name: escapeHtml(a.name || a.url.split("/").pop() || "attachment"),
            size: typeof a.size === "number" ? a.size : null,
          }))
      : [];

    connection = await mysql.createConnection(dbConfig);

    const [editorRows] = await connection.execute(
      "SELECT email FROM editors WHERE email = ? AND editorial_level IN (?, ?, ?)",
      [editor, "editor_in_chief", "admin", "editorial_assistant"]
    );

    if (editorRows.length === 0) {
      return res.status(403).json({
        status: "error",
        message: "Only Editor-in-Chief or Admin can invite editors",
      });
    }

    const editor_email = editorRows[0].email;

    const [isAuthor] = await connection.execute(
      "SELECT 1 FROM submission_authors WHERE authors_email = ? AND submission_id = ?",
      [reviewerEmail, articleId]
    );
    if (isAuthor.length > 0) {
      return res.status(400).json({ status: "error", message: "Editor cannot be an author of this article" });
    }

    const [existingInvitation] = await connection.execute(
      `SELECT 1 FROM invitations
       WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'To Edit'
         AND invitation_status IN (?, ?)`,
      [articleId, reviewerEmail, "pending", "invite_sent"]
    );
    if (existingInvitation.length > 0) {
      return res.status(200).json({
        status: "warning",
        message: `Invitation already sent to ${reviewerEmail}`,
      });
    }

    const ccEmails = ccEmail ? ccEmail.split(",").map((e) => e.trim()).filter(Boolean) : [];
    const bccEmails = bccEmail ? bccEmail.split(",").map((e) => e.trim()).filter(Boolean) : [];

    const emailSent = await ReviewerAccountEmail(
      reviewerEmail,
      subject,
      message,
      editor_email,
      articleId,
      ccEmails,
      bccEmails,
      attachments,
      "editor_invitation"
    );

    if (emailSent.status !== "success") {
      console.error("Email sending failed:", emailSent);
      return res.status(500).json({ status: "error", message: emailSent.message || "Could not send email" });
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 14);

    await connection.execute(
      `INSERT INTO invitations
       (invitation_link, invited_user, invited_user_name, invitation_status, invitation_expiry_date, invited_for)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        articleId,
        reviewerEmail,
        editor_email,
        "pending",
        expiryDate.toISOString().split("T")[0],
        "To Edit",
      ]
    );

    return res.json({
      status: "success",
      message: "Editor invitation sent successfully",
      data: {
        editorEmail: reviewerEmail,
        articleId,
        expiryDate: expiryDate.toISOString(),
        attachments: attachments.length,
      },
    });
  } catch (error) {
    console.error("Error in inviteEditorEmail:", error);
    return res.status(500).json({
      status: "error",
      message: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    });
  } finally {
    if (connection) await connection.end();
  }
};

module.exports = inviteEditorEmail;