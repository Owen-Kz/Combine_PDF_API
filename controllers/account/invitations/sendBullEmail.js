const Brevo = require("@getbrevo/brevo");
const dotenv = require("dotenv");
const db = require("../../../routes/db.config");
const { promisify } = require("util");

dotenv.config();

// Promisify database queries
const dbQuery = promisify(db.query).bind(db);

/**
 * Convert Quill JSON to HTML with proper sanitization
 * @param {Array} contentArray - Quill Delta content array
 * @returns {String} - HTML string
 */
const convertToHTML = (contentArray) => {
  let html = "";
  let listOpen = false;
  let listType = "";

  const escapeHtml = (unsafe) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  contentArray.forEach((item) => {
    if (item.attributes?.list) {
      const currentListType = item.attributes.list;

      if (["ordered", "bullet"].includes(currentListType)) {
        if (!listOpen) {
          html += currentListType === "ordered" ? "<ol>" : "<ul>";
          listOpen = true;
          listType = currentListType;
        } else if (listType !== currentListType) {
          html += listType === "ordered" ? "</ol>" : "</ul>";
          html += currentListType === "ordered" ? "<ol>" : "<ul>";
          listType = currentListType;
        }

        html += `<li>${escapeHtml(item.insert)}</li>`;
      }
    } else {
      if (listOpen) {
        html += listType === "ordered" ? "</ol>" : "</ul>";
        listOpen = false;
      }

      if (item.insert.image) {
        const src = escapeHtml(item.insert.image);
        html += `<img src="${src}" alt="Image" style="max-width:100%;height:auto;">`;
      } else {
        let text = escapeHtml(item.insert).replace(/\n/g, "<br>");

        if (item.attributes) {
          if (item.attributes.link) {
            const url = escapeHtml(item.attributes.link);
            text = `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
          }
          if (item.attributes.underline) {
            text = `<u>${text}</u>`;
          }
          if (item.attributes.color) {
            const color = escapeHtml(item.attributes.color);
            text = `<span style="color:${color};">${text}</span>`;
          }
          if (item.attributes.bold) {
            text = `<strong>${text}</strong>`;
          }
        }
        html += text;
      }
    }
  });

  if (listOpen) {
    html += listType === "ordered" ? "</ol>" : "</ul>";
  }

  return html;
};

/**
 * Send bulk email with proper tracking and deliverability features
 * @param {String} recipientEmail - Recipient email address
 * @param {String} subject - Email subject
 * @param {String} message - Quill JSON message content
 * @param {String} editorEmail - Sender's email
 * @param {String} articleId - Related article ID
 * @param {Array} attachments - Array of attachments
 * @returns {Object} - Status object
 */
const sendBulkEmail = async (recipientEmail, subject, message, editorEmail, articleId, attachments) => {
  try {
    // Validate inputs
    if (!recipientEmail || !subject || !message) {
      return { status: "error", message: "Missing required fields" };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return { status: "error", message: "Invalid email format" };
    }

    // Configure Brevo API
    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.authentications.apiKey.apiKey = process.env.BREVO_API_KEY;

    // Convert message to HTML
    const contentArray = JSON.parse(message);
    const htmlContent = convertToHTML(contentArray);

    // Create full email template
    const currentYear = new Date().getUTCFullYear();
    const emailTemplate = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(subject)}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; font-size: 0.8em; color: #666; }
          img { max-width: 100%; height: auto; }
          a { color: #0066cc; text-decoration: none; }
        </style>
      </head>
      <body>
        <div>${htmlContent}</div>
        <footer>
          <p>ASFI Research Journal &copy; ${currentYear}</p>
          <p>
            <a href="https://asfirj.org/unsubscribe?email=${encodeURIComponent(recipientEmail)}" style="color:#666;">
              Unsubscribe
            </a>
          </p>
        </footer>
      </body>
      </html>
    `;

    // Prepare email data
    const emailData = {
      sender: { 
        email: process.env.BREVO_EMAIL, 
        name: "ASFI Research Journal" 
      },
      to: [{ email: recipientEmail }],
      subject: escapeHtml(subject),
      htmlContent: emailTemplate,
      headers: {
        'List-Unsubscribe': `<https://asfirj.org/unsubscribe?email=${encodeURIComponent(recipientEmail)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Mailer': 'ASFI Research Journal Platform',
        'Precedence': 'bulk' // Important for bulk emails
      },
      ...(attachments?.length > 0 && {
        attachment: attachments.map(att => ({
          url: att.url || att.content,
          name: escapeHtml(att.name)
        }))
      })
    };

    // Send email
    await apiInstance.sendTransacEmail(emailData);

    // Update email status in database
    await dbQuery(
      `UPDATE sent_emails 
       SET status = 'Delivered', 
           delivered_at = NOW() 
       WHERE article_id = ? AND sender = ? AND subject = ?`,
      [articleId, editorEmail, subject]
    );

    console.log(`Email successfully sent to ${recipientEmail}`);
    return { 
      status: "success", 
      message: "Email sent successfully",
      recipient: recipientEmail
    };

  } catch (error) {
    console.error("Email sending failed:", error);

    // Update database with failure status
    try {
      await dbQuery(
        `UPDATE sent_emails 
         SET status = 'Failed', 
             error_message = ? 
         WHERE article_id = ? AND sender = ? AND subject = ?`,
        [error.message.substring(0, 255), articleId, editorEmail, subject]
      );
    } catch (dbError) {
      console.error("Failed to update email status:", dbError);
    }

    return { 
      status: "error", 
      message: "Failed to send email",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    };
  }
};

module.exports = { sendBulkEmail };