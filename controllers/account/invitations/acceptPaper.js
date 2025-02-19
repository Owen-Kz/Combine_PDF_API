const express = require("express");
const multer = require("multer");
const mysql = require("mysql2/promise");

const saveEmailDetails = require("./saveEmail");
const { ReviewerAccountEmail } = require("./revieweerAccountEmail");
const { AcceptanceEmailToEditor } = require("./acceptanceEMailToEDitor");
const { uploadToCloudinary } = require("./uploadToCloudinary");

const upload = multer({ dest: "uploads/" });

const dbConfig = {
  host: process.env.D_HOST,
  user: process.env.D_USER,
  password: process.env.D_PASSWORD,
  database: process.env.D_NAME,
};

const AcceptPaper = async (req, res) => {
  let connection;
  let responseSent = false; // Flag to ensure only one response is sent

  try {
    // Multer middleware as a promise
    await new Promise((resolve, reject) => {
      upload.array("attachments[]")(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const { articleId, reviewerEmail, subject, message, ccEmail, bccEmail } = req.body;
    const editor = req.user?.email || "";

    if (!editor) {
      return res.status(401).json({ status: "error", message: "Unauthorized account" });
    }

    connection = await mysql.createConnection(dbConfig);

    // Validate editor's role
    const [editorRows] = await connection.execute(
      "SELECT email FROM editors WHERE email = ? AND (editorial_level IN (?, ?, ?))",
      [editor, "editor_in_chief", "associate_editor", "editorial_assistant"]
    );

    if (editorRows.length === 0) {
      res.status(403).json({ status: "error", message: "Unauthorized account" });
      responseSent = true;
      return;
    }

    const editor_email = editorRows[0].email;

    // Check if email was already sent
    const [existingEmails] = await connection.execute(
      "SELECT status FROM sent_emails WHERE article_id = ? AND sender = ? AND subject = ?",
      [articleId, editor_email, subject]
    );

    if (existingEmails.length > 0 && existingEmails[0].status === "Delivered") {
      res.json({ status: "warning", message: "Email already sent" });
      responseSent = true;
      return;
    }

    // Collect file attachments
    let attachments = [];
    if (req.files) {
      for (const file of req.files) {
        try {
          const cloudinaryUrl = await uploadToCloudinary(file.path, file.originalname);
          attachments.push({
            content: file.buffer.toString("base64"),
            name: file.originalname,
            url: cloudinaryUrl,
          });
        } catch (error) {
          console.error("Error uploading to Cloudinary:", error);
        }
      }
    }

    // Convert comma-separated CC and BCC to arrays
    const ccEmails = ccEmail ? ccEmail.split(",") : [];
    const bccEmails = bccEmail ? bccEmail.split(",") : [];

    // Update article status
    await connection.execute("UPDATE submissions SET status = 'accepted' WHERE revision_id = ?", [articleId]);

    // Save email details
    await saveEmailDetails(reviewerEmail, subject, message, editor_email, articleId, ccEmails, bccEmails, attachments, "");

    // Send email to reviewer
    const emailSent = await ReviewerAccountEmail(reviewerEmail, subject, message, editor_email, articleId, ccEmails, bccEmails, attachments);

    if (!emailSent) {
      res.status(500).json({ status: "error", message: "Could not send email" });
      responseSent = true;
      return;
    }

    // Mark email as sent
    // await connection.execute(
    //   "INSERT INTO sent_emails (article_id, sender, subject, status) VALUES (?, ?, ?, 'Delivered') ON DUPLICATE KEY UPDATE status = 'Delivered'",
    //   [articleId, editor_email, subject]
    // );

    // Get Editor-in-Chief email
    const [chiefRows] = await connection.execute(
      "SELECT email FROM editors WHERE editorial_level = 'editor_in_chief'"
    );
  
    if (chiefRows.length > 0) {
      const ChiefEmail = chiefRows[0].email;
      await AcceptanceEmailToEditor(ChiefEmail, subject, message, editor_email, articleId, ccEmails, bccEmails);
    }

    if (!responseSent) {
      res.json({ status: "success", message: "Email has been sent" });
      responseSent = true;
    }

  } catch (error) {
    console.error("Error:", error);
    if (!responseSent) {
      res.status(500).json({ status: "error", message: "Internal server error" });
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

module.exports = AcceptPaper;
