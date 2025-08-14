const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const Brevo = require("@getbrevo/brevo");
const dotenv = require("dotenv");
const db = require("../../../routes/db.config");
const isAdminAccount = require("../../editors/isAdminAccount");
const saveEmailDetails = require("./saveEmail");
const { convertQUILLTOHTML, escapeHtml } = require("./convertHTML");
const { promisify } = require("util");

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 3 // Max 3 attachments
  }
});

// Promisify database queries
const dbQuery = promisify(db.query).bind(db);

/**
 * Sends an invitation email to an editor
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const inviteEditorEMail = async (req, res) => {
  try {
    // Validate user authentication
    if (!req.cookies.asfirj_userRegistered) {
      return res.status(401).json({ 
        status: "error", 
        message: "Authentication required" 
      });
    }

    // Check admin privileges
    const editorId = req.user.id;
    if (!(await isAdminAccount(editorId))) {
      return res.status(403).json({ 
        status: "error", 
        message: "Admin privileges required" 
      });
    }

    // Process file uploads
    await new Promise((resolve, reject) => {
      upload.array("attachments[]", 3)(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Extract and validate request data
    const { 
      articleId, 
      reviewerEmail, 
      subject, 
      message, 
      ccEmail, 
      bccEmail 
    } = req.body;

    if (!articleId || !reviewerEmail || !subject || !message) {
      return res.status(400).json({ 
        status: "error", 
        message: "Missing required fields" 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(reviewerEmail)) {
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid editor email format" 
      });
    }

    // Process attachments
    let attachments = [];
    if (req.files?.length > 0) {
      try {
        attachments = await Promise.all(
          req.files.map(file => {
            return new Promise((resolve, reject) => {
              cloudinary.uploader.upload_stream(
                { 
                  resource_type: "auto",
                  folder: "asfirj/editor_attachments"
                },
                (error, result) => {
                  if (error) reject(error);
                  else resolve({ 
                    name: escapeHtml(file.originalname), 
                    url: result.secure_url 
                  });
                }
              ).end(file.buffer);
            });
          })
        );
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        return res.status(500).json({ 
          status: "error", 
          message: "File upload failed" 
        });
      }
    }

    // Get editor details
    const editorData = await dbQuery(
      `SELECT email FROM editors 
       WHERE id = ? AND editorial_level IN (?, ?, ?)`,
      [editorId, "editor_in_chief", "associate_editor", "editorial_assistant"]
    );

    if (!editorData.length) {
      return res.status(403).json({ 
        status: "error", 
        message: "Unauthorized account" 
      });
    }
    const editorEmail = editorData[0].email;

    // Check if invited editor is an author
    const isAuthor = await dbQuery(
      `SELECT 1 FROM submission_authors 
       WHERE authors_email = ? AND submission_id = ?`,
      [reviewerEmail, articleId]
    );

    if (isAuthor.length > 0) {
      return res.status(400).json({ 
        status: "error", 
        message: "Editor cannot be an author of this article" 
      });
    }

    // Update submission status
    await dbQuery(
      `UPDATE submissions SET status = 'submitted_for_edit' 
       WHERE revision_id = ?`,
      [articleId]
    );

    // Record the invitation
    await dbQuery(
      `INSERT INTO submitted_for_edit 
       (article_id, editor_email, submitted_by) 
       VALUES (?, ?, ?)`,
      [articleId, reviewerEmail, editorEmail]
    );

    // Create invitation record
    const invitedFor = "To Edit";
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);
    
    await dbQuery(
      `INSERT INTO invitations 
       (invited_user, invitation_link, invitation_expiry_date, invited_for, invited_user_name) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        reviewerEmail, 
        articleId, 
        expiryDate.toISOString().split("T")[0], 
        invitedFor, 
        editorEmail
      ]
    );

    // Save email details
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

    // Configure Brevo API
    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      Brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );

    // Prepare email data
    const emailData = {
      sender: { 
        email: process.env.BREVO_EMAIL, 
        name: "ASFI Research Journal" 
      },
      to: [{ email: reviewerEmail }],
      subject: escapeHtml(subject),
      htmlContent: convertQUILLTOHTML(JSON.parse(message)),
      headers: {
        'List-Unsubscribe': `<https://asfirj.org/unsubscribe?email=${encodeURIComponent(reviewerEmail)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Mailer': 'ASFI Research Journal Platform'
      },
      ...(ccEmail && { 
        cc: ccEmail.split(",")
          .filter(Boolean)
          .map(email => ({ email: email.trim() })) 
      }),
      ...(bccEmail && { 
        bcc: bccEmail.split(",")
          .filter(Boolean)
          .map(email => ({ email: email.trim() })) 
      }),
      ...(attachments.length > 0 && {
        attachment: attachments.map(file => ({
          url: file.url,
          name: file.name
        }))
      })
    };

    // Send email
    await apiInstance.sendTransacEmail(emailData);

    return res.json({ 
      status: "success", 
      message: "Editor invitation sent successfully",
      data: {
        reviewerEmail,
        articleId,
        expiryDate: expiryDate.toISOString()
      }
    });

  } catch (error) {
    console.error("Error in inviteEditorEMail:", error);
    return res.status(500).json({ 
      status: "error", 
      message: "Internal server error",
      ...(process.env.NODE_ENV === "development" && { 
        error: error.message 
      })
    });
  }
};

module.exports = inviteEditorEMail;