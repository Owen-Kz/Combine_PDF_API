const mysql = require("mysql2/promise");
const Brevo = require("@getbrevo/brevo");
const multer = require("multer");
const fs = require("fs");
const dotenv = require("dotenv");
const saveEmailDetails = require("../../account/invitations/saveEmail");
dotenv.config();

const dbConfig = {
  host: process.env.D_HOST,
  user: process.env.D_USER,
  password: process.env.D_PASSWORD,
  database: process.env.D_NAME,
};

const upload = multer({ dest: "uploads/" });

const submitDecision = async (req, res) => {
  let connection;
  try {
    // Parse multipart form data (attachments[])
    await new Promise((resolve, reject) => {
      upload.array("attachments[]")(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const { articleId, decisionType, compiledLetter, subject, message, ccEmail, bccEmail } = req.body;
    const editorEmail = req.user?.email || "";

    if (!editorEmail) {
      return res.status(401).json({ status: "error", message: "Authentication required" });
    }
    if (!articleId || !decisionType || !subject || !message) {
      return res.status(400).json({ status: "error", message: "articleId, decisionType, subject, and message are required" });
    }

    const validDecisions = ["accept", "reject", "revise", "return"];
    if (!validDecisions.includes(decisionType)) {
      return res.status(400).json({ status: "error", message: "Invalid decision type. Must be accept, reject, revise, or return" });
    }

    connection = await mysql.createConnection(dbConfig);

    const [editorRows] = await connection.execute(
      "SELECT email, fullname FROM editors WHERE email = ?",
      [editorEmail]
    );
    if (editorRows.length === 0) {
      return res.status(403).json({ status: "error", message: "Editor account not found" });
    }
    const editorFullname = editorRows[0].fullname || editorEmail;

    const [submission] = await connection.execute(
      "SELECT id, revision_id, title, corresponding_authors_email FROM submissions WHERE revision_id = ?",
      [articleId]
    );
    if (submission.length === 0) {
      return res.status(404).json({ status: "error", message: "Submission not found" });
    }

    const [invitation] = await connection.execute(
      "SELECT 1 FROM invitations WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'To Decide' AND invitation_status IN ('pending', 'invite_sent')",
      [articleId, editorEmail]
    );
    if (invitation.length === 0) {
      return res.status(403).json({ status: "error", message: "No active decision invitation found for this editor" });
    }

    const statusMap = {
      accept: "accepted",
      reject: "rejected",
      revise: "returned_for_revision",
      return: "returned_for_correction",
    };
    const newStatus = statusMap[decisionType];

    await connection.execute(
      "UPDATE submissions SET status = ?, last_updated = NOW() WHERE revision_id = ?",
      [newStatus, articleId]
    );

    let compiledHtml = "";
    if (compiledLetter) {
      compiledHtml = `<div style="margin: 16px 0; padding: 16px; background: #f9fafb; border-left: 4px solid #7c3aed; border-radius: 4px;">${compiledLetter}</div>`;
    }

    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #501f46;">Editorial Decision: ${submission[0].revision_id}</h2>
        <p>Dear Author,</p>
        <p>We have reached a decision on your manuscript titled <strong>"${submission[0].title}"</strong> (ID: ${submission[0].revision_id}).</p>
        <p><strong>Decision: ${decisionType.toUpperCase()}</strong></p>
        ${compiledHtml}
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 0.85em; color: #666;">ASFI Research Journal Editorial System</p>
      </body>
      </html>
    `;

    const authorEmail = submission[0].corresponding_authors_email;
    const emailData = {
      sender: { email: process.env.BREVO_EMAIL, name: "ASFI Research Journal" },
      to: [{ email: authorEmail }],
      subject: subject,
      htmlContent: emailHtml,
    };

    if (ccEmail) {
      const ccList = ccEmail.split(",").map(e => e.trim()).filter(Boolean);
      if (ccList.length > 0) emailData.cc = ccList.map(e => ({ email: e }));
    }
    if (bccEmail) {
      const bccList = bccEmail.split(",").map(e => e.trim()).filter(Boolean);
      if (bccList.length > 0) emailData.bcc = bccList.map(e => ({ email: e }));
    }

    // Collect and attach files (max 10)
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files.slice(0, 10)) {
        try {
          const content = fs.readFileSync(file.path).toString("base64");
          attachments.push({
            content,
            name: file.originalname,
            contentType: file.mimetype || "application/octet-stream",
            size: file.size
          });
        } catch (err) {
          console.error(`Failed to process attachment ${file.originalname}:`, err.message);
        }
      }
      if (attachments.length > 0) {
        emailData.attachment = attachments.map(att => ({
          content: att.content,
          name: att.name,
          contentType: att.contentType
        }));
      }
    }

    await apiInstance.sendTransacEmail(emailData);

    await saveEmailDetails(
      authorEmail,
      subject,
      JSON.stringify({ message: message || "", compiledLetter: compiledLetter || "" }),
      editorEmail,
      articleId,
      ccEmail ? ccEmail.split(",").map(e => e.trim()).filter(Boolean) : [],
      bccEmail ? bccEmail.split(",").map(e => e.trim()).filter(Boolean) : [],
      [],
      `${decisionType}_paper`,
      "Delivered"
    );

    await connection.execute(
      "UPDATE invitations SET invitation_status = 'completed' WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'To Decide'",
      [articleId, editorEmail]
    );

    return res.json({
      status: "success",
      message: `Decision (${decisionType}) has been submitted and the author has been notified`,
    });
  } catch (error) {
    console.error("Error submitting decision:", error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  } finally {
    if (connection) await connection.end();
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          // ignore cleanup errors
        }
      }
    }
  }
};

module.exports = submitDecision;
