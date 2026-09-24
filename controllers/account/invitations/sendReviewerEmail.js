// backend/controllers/editors/email/inviteReviewerEmail.js
const sendMail = require("../../utils/nodeMailer");
const dotenv = require("dotenv");
const saveEmailDetails = require("./saveEmail");
const isAdminAccount = require("../../editors/isAdminAccount");
const db = require("../../../routes/db.config");
const { promisify } = require("util");
const { escapeHtml } = require("../../utils/security");
const convertQUILLTOHTML = require("./convertHTML");

dotenv.config();

const dbQuery = promisify(db.query).bind(db);

const inviteReviewerEmail = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    const {
      articleId,
      reviewerEmail,
      subject,
      message,
      ccEmail,
      bccEmail,
      handlingEditorEmail,
      attachments: attachmentInput = [],
    } = req.body;

    if (!articleId || !reviewerEmail || !subject || !message) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(reviewerEmail)) {
      return res.status(400).json({ status: "error", message: "Invalid reviewer email format" });
    }

    // Attachments arrive as [{ url, name, size }] from the upload endpoint.
    // Normalise and sanitize the display name. Reject any entry without a URL.
    const attachments = Array.isArray(attachmentInput)
      ? attachmentInput
          .filter((a) => a && typeof a.url === "string" && a.url.trim())
          .map((a) => ({
            url: a.url.trim(),
            name: escapeHtml(a.name || a.url.split("/").pop() || "attachment"),
            size: typeof a.size === "number" ? a.size : null,
          }))
      : [];

    // Get editor details
    const editorData = await dbQuery(
      `SELECT email FROM editors
       WHERE email = ? AND editorial_level IN (?, ?, ?, ?)`,
      [req.user.email, "editor_in_chief", "associate_editor", "editorial_assistant", "sectional_editor"]
    );

    if (!editorData.length) {
      return res.status(403).json({ status: "error", message: "Unauthorized account" });
    }

    // Determine the handling editor
    let editorEmail = editorData[0].email;
    if (handlingEditorEmail && handlingEditorEmail.trim()) {
      const normalized = handlingEditorEmail.trim();
      if (!emailRegex.test(normalized)) {
        return res.status(400).json({ status: "error", message: "Invalid handling editor email format" });
      }
      if (normalized.toLowerCase() !== editorEmail.toLowerCase()) {
        const handlingEditorData = await dbQuery(`SELECT email FROM editors WHERE email = ?`, [normalized]);
        if (!handlingEditorData.length) {
          return res.status(400).json({
            status: "error",
            message: "Handling editor email is not a registered editor account",
          });
        }
        editorEmail = handlingEditorData[0].email;
      }
    }

    // Reviewer cannot be an author of the manuscript
    const isAuthor = await dbQuery(
      `SELECT 1 FROM submission_authors WHERE authors_email = ? AND submission_id = ?`,
      [reviewerEmail, articleId]
    );
    if (isAuthor.length > 0) {
      return res.status(400).json({ status: "error", message: "Reviewer cannot be an author of this article" });
    }

    // Avoid duplicate invitations
    const existingInvitation = await dbQuery(
      `SELECT 1 FROM submitted_for_review
       WHERE article_id = ? AND reviewer_email = ?
         AND status IN (?, ?, ?)`,
      [articleId, reviewerEmail, "submitted_for_review", "review_invitation_accepted", "review_submitted"]
    );
    if (existingInvitation.length > 0) {
      return res.status(200).json({
        status: "success",
        message: `Invitation already sent to ${reviewerEmail}`,
      });
    }

    await dbQuery(
      `UPDATE submissions SET status = 'submitted_for_review' WHERE revision_id = ?`,
      [articleId]
    );

    const invitedFor = "Submission Review";

    saveEmailDetails(
      reviewerEmail,
      escapeHtml(subject),
      message,
      editorEmail,
      articleId,
      ccEmail?.split(",").filter(Boolean),
      bccEmail?.split(",").filter(Boolean),
      attachments,
      invitedFor
    );

    const emailData = {
      sender: {
        email: process.env.NODE_MAILER_SENDER_EMAIL || process.env.NODE_MAILER_EMAIL,
        name: "ASFI Research Journal",
      },
      to: [{ email: reviewerEmail }],
      subject: escapeHtml(subject),
      htmlContent: convertQUILLTOHTML(JSON.parse(message)),
      headers: {
        'List-Unsubscribe': `<https://asfirj.org/unsubscribe?email=${encodeURIComponent(reviewerEmail)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      ...(ccEmail && {
        cc: ccEmail.split(",").filter(Boolean).map((email) => ({ email: email.trim() })),
      }),
      ...(bccEmail && {
        bcc: bccEmail.split(",").filter(Boolean).map((email) => ({ email: email.trim() })),
      }),
      // Brevo/Sendinblue accepts remote URLs directly — no need to re-upload
      ...(attachments.length > 0 && {
        attachment: attachments.map((file) => ({ url: file.url, name: file.name })),
      }),
    };

    await sendMail(emailData);

    await dbQuery(
      `INSERT INTO submitted_for_review (article_id, reviewer_email, submitted_by) VALUES (?, ?, ?)`,
      [articleId, reviewerEmail, editorEmail]
    );

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 3);

    await dbQuery(
      `INSERT INTO invitations
       (invited_user, invitation_link, invitation_expiry_date, invited_for, invited_user_name)
       VALUES (?, ?, ?, ?, ?)`,
      [reviewerEmail, articleId, expiryDate.toISOString().split("T")[0], invitedFor, editorEmail]
    );

    return res.json({
      status: "success",
      message: "Review invitation sent successfully",
      data: {
        reviewerEmail,
        articleId,
        expiryDate: expiryDate.toISOString(),
        attachments: attachments.length,
      },
    });
  } catch (error) {
    console.error("Error in inviteReviewerEmail:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};

module.exports = inviteReviewerEmail;