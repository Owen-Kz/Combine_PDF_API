// backend/controllers/editors/sendReviewReminder.js
const Brevo = require("@getbrevo/brevo");
const { escapeHtml } = require("../../utils/security");
const convertQUILLTOHTML = require("./convertHTML");
const dotenv = require("dotenv");
const db = require("../../../routes/db.config");
const dbPromise = require("../../../routes/dbPromise.config");
dotenv.config();
/**
 * Sends a reminder email to a reviewer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendReviewReminder = async (req, res) => {
  try {
    // Validate user authentication
    if (!req.user) {
      return res.status(401).json({ 
        status: "error", 
        message: "Authentication required" 
      });
    }

    const { 
      reviewId, 
      articleId, 
      reviewerEmail, 
      reminderType = 'manual',
      customMessage,
      dueDate,
      daysOverdue
    } = req.body;

    if (!reviewId || !articleId || !reviewerEmail) {
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
        message: "Invalid reviewer email format" 
      });
    }

    // Get editor details
    const [editorResults] = await dbPromise.query(
      `SELECT email, fullname FROM editors WHERE email = ?`,
      [req.user.email]
    );

    if (editorResults.length === 0) {
      return res.status(403).json({ 
        status: "error", 
        message: "Unauthorized account" 
      });
    }

    const editorEmail = editorResults[0].email;
    const editorName = editorResults[0].fullname;

    // Get manuscript details
    const [manuscriptResults] = await dbPromise.query(
      `SELECT title, revision_id FROM submissions WHERE revision_id = ?`,
      [articleId]
    );

    if (manuscriptResults.length === 0) {
      return res.status(404).json({ 
        status: "error", 
        message: "Manuscript not found" 
      });
    }

    const manuscriptTitle = manuscriptResults[0].title;

    // Get reminder count for this review
    const [reminderResults] = await dbPromise.query(
      `SELECT COUNT(*) as count FROM review_reminders 
       WHERE review_id = ? AND article_id = ? AND reviewer_email = ?`,
      [reviewId, articleId, reviewerEmail]
    );

    const reminderNumber = (reminderResults[0].count || 0) + 1;

    // Create reminder subject based on number and days overdue
    let subject = '';
    let htmlContent = '';

    if (daysOverdue && daysOverdue > 0) {
      // Overdue reminder
      if (reminderNumber === 1) {
        subject = `Reminder: Review Overdue for Manuscript ${articleId}`;
      } else if (reminderNumber === 2) {
        subject = `URGENT: Second Reminder - Review Overdue for Manuscript ${articleId}`;
      } else {
        subject = `FINAL REMINDER: Review Significantly Overdue for Manuscript ${articleId}`;
      }

      // Create HTML content for overdue reminder
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapeHtml(subject)}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(to right, #dc2626, #991b1b); color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px 20px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 30px; background: #7e22ce; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .button:hover { background: #6b21a8; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; border-top: 1px solid #eee; }
            .warning { background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Review Reminder</h2>
          </div>
          <div class="content">
            <p>Dear Reviewer,</p>
            
            ${customMessage ? `<p>${escapeHtml(customMessage)}</p>` : ''}
            
            <div class="warning">
              <p><strong>⚠️ This is a reminder #${reminderNumber} for your review of:</strong></p>
              <p>Manuscript ID: ${articleId}</p>
              <p>Title: "${escapeHtml(manuscriptTitle)}"</p>
              ${dueDate ? `<p>Original Due Date: ${dueDate}</p>` : ''}
              ${daysOverdue ? `<p>Days Overdue: ${daysOverdue}</p>` : ''}
            </div>
            
            <p>Your timely review is crucial for the publication process. Please submit your review as soon as possible.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/reviewerdash/review/${articleId}" class="button">Go to Review</a>
            </div>
            
            <p>If you are unable to complete this review, please let us know immediately by responding to this email.</p>
            
            <p>Thank you for your attention to this matter.</p>
            
            <p>Best regards,<br>
            ${escapeHtml(editorName)}<br>
            ASFIRJ Editorial Office</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ASFI Research Journal. All rights reserved.</p>
            <p style="font-size: 0.8em;">
              <a href="${process.env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(reviewerEmail)}">Unsubscribe</a>
            </p>
          </div>
        </body>
        </html>
      `;
    } else {
      // Regular reminder (not overdue)
      subject = `Reminder: Review Due Soon for Manuscript ${articleId}`;

      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapeHtml(subject)}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(to right, #7e22ce, #6b21a8); color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px 20px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 30px; background: #7e22ce; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .button:hover { background: #6b21a8; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Review Reminder</h2>
          </div>
          <div class="content">
            <p>Dear Reviewer,</p>
            
            ${customMessage ? `<p>${escapeHtml(customMessage)}</p>` : ''}
            
            <p>This is a friendly reminder about your review of:</p>
            
            <p><strong>Manuscript ID:</strong> ${articleId}</p>
            <p><strong>Title:</strong> "${escapeHtml(manuscriptTitle)}"</p>
            ${dueDate ? `<p><strong>Due Date:</strong> ${dueDate}</p>` : ''}
            
            <p>Please submit your review at your earliest convenience.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/reviewerdash/review/${articleId}" class="button">Go to Review</a>
            </div>
            
            <p>Thank you for your contribution to ASFIRJ.</p>
            
            <p>Best regards,<br>
            ${escapeHtml(editorName)}<br>
            ASFIRJ Editorial Office</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ASFI Research Journal. All rights reserved.</p>
          </div>
        </body>
        </html>
      `;
    }

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
      subject: subject,
      htmlContent: htmlContent,
      headers: {
        'List-Unsubscribe': `<${process.env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(reviewerEmail)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    };

    // Send email
    await apiInstance.sendTransacEmail(emailData);

    // Insert reminder record into review_reminders table
    await dbPromise.query(
      `INSERT INTO review_reminders 
       (review_id, article_id, reviewer_email, reminder_type, reminder_number, 
        due_date, days_overdue, status, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?)`,
      [
        reviewId,
        articleId,
        reviewerEmail,
        reminderType,
        reminderNumber,
        dueDate || null,
        daysOverdue || null,
        customMessage || null
      ]
    );

    return res.json({ 
      status: "success", 
      message: `Reminder #${reminderNumber} sent successfully to ${reviewerEmail}`,
      data: {
        reviewId,
        articleId,
        reviewerEmail,
        reminderNumber
      }
    });

  } catch (error) {
    console.error("Error sending review reminder:", error);
    return res.status(500).json({ 
      status: "error", 
      message: "Internal server error",
      ...(process.env.NODE_ENV === "development" && { 
        error: error.message 
      })
    });
  }
};

module.exports = sendReviewReminder;