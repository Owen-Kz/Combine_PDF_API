const multer = require("multer");
const mysql = require("mysql2/promise");
const { ReviewerAccountEmail } = require("./revieweerAccountEmail");
const { uploadToCloudinary } = require("./uploadToCloudinary");
const dotenv = require("dotenv");

dotenv.config();

// Configure multer for file uploads with disk storage
const upload = multer({ dest: "uploads/" });

const dbConfig = {
  host: process.env.D_HOST,
  user: process.env.D_USER,
  password: process.env.D_PASSWORD,
  database: process.env.D_NAME,
};

/**
 * Sends an invitation email to an editor
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const inviteEditorEmail = async (req, res) => {
  let connection;
  let responseSent = false;

  try {
    // Process file uploads using multer
    await new Promise((resolve, reject) => {
      upload.array("attachments[]", 10)(req, res, (err) => {
        if (err) {
          console.error("Multer error:", err);
          reject(err);
        } else resolve();
      });
    });

    // Extract and validate request data
    const { 
      articleId, 
      reviewerEmail, 
      subject, 
      message, 
      ccEmail, 
      bccEmail,
      acceptLink,
      declineLink,
      invitationType
    } = req.body;

    const editor = req.user?.email || "";

    if (!editor) {
      return res.status(401).json({ 
        status: "error", 
        message: "Authentication required" 
      });
    }

    if (!articleId || !reviewerEmail || !subject || !message) {
      return res.status(400).json({ 
        status: "error", 
        message: "Missing required fields" 
      });
    }

    connection = await mysql.createConnection(dbConfig);

    // Validate editor's role (only editor-in-chief and admin can invite editors)
    const [editorRows] = await connection.execute(
      "SELECT email FROM editors WHERE email = ? AND (editorial_level IN (?, ?, ?))",
      [editor, "editor_in_chief", "admin", "editorial_assistant"]
    );

    if (editorRows.length === 0) {
      return res.status(403).json({ 
        status: "error", 
        message: "Only Editor-in-Chief or Admin can invite editors" 
      });
    }

    const editor_email = editorRows[0].email;

    // Check if invited editor already exists
    const [existingEditor] = await connection.execute(
      "SELECT email FROM editors WHERE email = ?",
      [reviewerEmail]
    );

    // if (existingEditor.length > 0) {
    //   return res.status(400).json({ 
    //     status: "error", 
    //     message: "This email is already registered as an editor" 
    //   });
    // }

    // Check if editor is an author of this submission
    const [isAuthor] = await connection.execute(
      "SELECT 1 FROM submission_authors WHERE authors_email = ? AND submission_id = ?",
      [reviewerEmail, articleId]
    );

    if (isAuthor.length > 0) {
      return res.status(400).json({ 
        status: "error", 
        message: "Editor cannot be an author of this article" 
      });
    }

    // Check for existing invitations
    const [existingInvitation] = await connection.execute(
      `SELECT 1 FROM invitations 
       WHERE invitation_link = ? AND invited_user = ? AND invited_for ="To Edit" AND (invitation_status = ? OR invitation_status = ?)`,
      [articleId, reviewerEmail, "pending", "invite_sent"]
    );

    if (existingInvitation.length > 0) {
      return res.status(200).json({ 
        status: "warning", 
        message: `Invitation already sent to ${reviewerEmail}` 
      });
    }

    // Collect file attachments with retry logic
    let attachments = [];
    if (req.files && req.files.length > 0) {
      console.log(`Processing ${req.files.length} file(s) for upload...`);
      
      for (const file of req.files) {
        try {
          const cloudinaryUrl = await uploadToCloudinary(
            file.path,
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
          attachments.push({
            name: file.originalname,
            error: error.message,
            failed: true
          });
        }
      }
    }

    // Process CC and BCC emails
    const ccEmails = ccEmail ? ccEmail.split(",").map(email => email.trim()).filter(Boolean) : [];
    const bccEmails = bccEmail ? bccEmail.split(",").map(email => email.trim()).filter(Boolean) : [];

    // Send email to editor using the ReviewerAccountEmail function
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
      return res.status(500).json({ 
        status: "error", 
        message: emailSent.message || "Could not send email" 
      });
    }

    // Create editor invitation record with expiry date (14 days from now for editors)
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
        "To Edit" 
      ]
    );

    return res.json({ 
      status: "success", 
      message: "Editor invitation sent successfully",
      data: {
        editorEmail: reviewerEmail,
        articleId,
        expiryDate: expiryDate.toISOString(),
        attachments: attachments.filter(a => !a.failed).length
      }
    });

  } catch (error) {
    console.error("Error in inviteEditorEmail:", error);
    if (!responseSent) {
      return res.status(500).json({ 
        status: "error", 
        message: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
      });
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

module.exports = inviteEditorEmail;