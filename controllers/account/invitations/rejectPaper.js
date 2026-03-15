const express = require("express");
const multer = require("multer");
const mysql = require("mysql2/promise");

const saveEmailDetails = require("./saveEmail");
const { ReviewerAccountEmail } = require("./revieweerAccountEmail");
const { uploadToCloudinary } = require("./uploadToCloudinary");
const { config } = require("dotenv");

const upload = multer({ dest: "uploads/" });
config()

const dbConfig = {
  host: process.env.D_HOST,
  user: process.env.D_USER,
  password: process.env.D_PASSWORD,
  database: process.env.D_NAME,
};

const RejectPaper = async (req, res) => {
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
      "SELECT status FROM sent_emails WHERE article_id = ? AND sender = ? AND subject = ? AND email_for = 'reject_paper' ",
      [articleId, editor_email, subject]
    );

    if (existingEmails.length > 0 && existingEmails[0].status === "Delivered") {
      res.json({ status: "warning", message: "Email already sent" });
      responseSent = true;
      return;
    }

    // Collect file attachments
   let attachments = [];
if (req.files && req.files.length > 0) {
  console.log(`Processing ${req.files.length} file(s) for upload...`);
  
  for (const file of req.files) {
    try {
      // Use the enhanced upload function with retry logic
      const cloudinaryUrl = await uploadToCloudinary(
        file.path, // or file.buffer if using memory storage
        file.originalname,
        3, // max retries
        1000 // initial delay
      );
      
      attachments.push({
        content: file.buffer ? file.buffer.toString("base64") : null,
        name: file.originalname,
        url: cloudinaryUrl,
        size: file.size,
        mimetype: file.mimetype
      });
      
      console.log(`Successfully uploaded: ${file.originalname}`);
      
    } catch (error) {
      console.error(`Failed to upload ${file.originalname} after retries:`, error.message);
      
      // Optionally, you can still proceed without this attachment
      // or notify the user about the failure
      attachments.push({
        name: file.originalname,
        error: error.message,
        failed: true
      });
    }
  }
  
  // Check if any files failed to upload
  const failedUploads = attachments.filter(att => att.failed);
  if (failedUploads.length > 0) {
    console.warn(`${failedUploads.length} file(s) failed to upload:`, 
      failedUploads.map(f => f.name).join(', '));
  }
}

    // Convert comma-separated CC and BCC to arrays
    const ccEmails = ccEmail ? ccEmail.split(",") : [];
    const bccEmails = bccEmail ? bccEmail.split(",") : [];

    // Update article status
    console.log(articleId)
    await connection.execute("UPDATE submissions SET status = 'rejected' WHERE revision_id = ?", [articleId]);

    // Save email details
    // await saveEmailDetails(reviewerEmail, subject, message, editor_email, articleId, ccEmails, bccEmails, attachments, "reject_paper");
    
    // Send email to reviewer
    const emailSent = await ReviewerAccountEmail(reviewerEmail, subject, message, editor_email, articleId, ccEmails, bccEmails, attachments, "reject_paper");
    if (emailSent.status !== "success") {
    // await ReviewerAccountEmail("company@weperch.live", "Error Sending Email", `[{insert:<p>Error Sending Email tO ${reviewerEmail}}]`, "submissions@asfirj.org", new Date(), [], [], []);

      res.status(500).json({ status: "error", message: emailSent.message });
      responseSent = true;
      return;
    }

    // // Mark email as sent
    // await connection.execute(
    //   "INSERT INTO sent_emails (article_id, sender, subject, status) VALUES (?, ?, ?, 'Delivered') ON DUPLICATE KEY UPDATE status = 'Delivered'",
    //   [articleId, editor_email, subject]
    // );


    

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

module.exports = RejectPaper;
