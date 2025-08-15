const Brevo = require("@getbrevo/brevo");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

// Database Configuration
const dbConfig = {
  host: process.env.D_HOST,
  user: process.env.D_USER,
  password: process.env.D_PASSWORD,
  database: process.env.D_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create a connection pool instead of single connection
const pool = mysql.createPool(dbConfig);

// Initialize Brevo API
const senderEmail = process.env.BREVO_EMAIL;
const apiKey = process.env.BREVO_API_KEY;
const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

// HTML escaping function to prevent XSS
const escapeHtml = (unsafe) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Convert Quill Delta JSON to HTML with proper sanitization
function convertToHTML(contentArray) {
  let html = "";
  let listOpen = false;
  let listType = "";

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
          if (item.attributes.underline) text = `<u>${text}</u>`;
          if (item.attributes.color) {
            const color = escapeHtml(item.attributes.color);
            text = `<span style="color:${color}">${text}</span>`;
          }
          if (item.attributes.bold) text = `<strong>${text}</strong>`;
        }
        html += text;
      }
    }
  });

  if (listOpen) {
    html += listType === "ordered" ? "</ol>" : "</ul>";
  }
  
  return html;
}

/**
 * Sends reviewer account email with proper tracking and security
 * @param {string} RecipientEmail - Email address of the recipient
 * @param {string} subject - Email subject
 * @param {string} message - Quill JSON message content
 * @param {string} editor_email - Sender's email
 * @param {string} article_id - Related article ID
 * @param {string|Array} ccEmails - CC email addresses
 * @param {string|Array} bccEmails - BCC email addresses
 * @param {Array} attachments - Array of attachment objects
 * @returns {Promise<Object>} - Status object
 */
async function ReviewerAccountEmail(RecipientEmail, subject, message, editor_email, article_id, ccEmails, bccEmails, attachments, email_for) {
  // Validate inputs
  if (!RecipientEmail || !subject || !message) {
    return { status: "error", message: "Missing required fields" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(RecipientEmail)) {
    return { status: "error", message: "Invalid recipient email format" };
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Process CC and BCC emails
    const processEmailList = (emails) => {
      if (!emails) return [];
      const emailArray = typeof emails === 'string' ? emails.split(',') : emails;
      return emailArray
        .map(email => email.trim())
        .filter(email => emailRegex.test(email));
    };

    const validCC = processEmailList(ccEmails);
    const validBCC = processEmailList(bccEmails);

    // Convert message to HTML
    const contentArray = JSON.parse(message);
    const htmlContent = convertToHTML(contentArray);
    const currentYear = new Date().getFullYear();

    // Create full email template
    const emailTemplate = `
      <!DOCTYPE html>
      <html>
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
            <a href="https://asfirj.org/unsubscribe?email=${encodeURIComponent(RecipientEmail)}" style="color:#666;">
              Unsubscribe
            </a>
          </p>
        </footer>
      </body>
      </html>
    `;

    // Prepare email data with deliverability headers
    const emailData = {
      sender: { 
        email: senderEmail, 
        name: "ASFI Research Journal" 
      },
      to: [{ email: RecipientEmail }],
      subject: escapeHtml(subject),
      htmlContent: emailTemplate,
      headers: {
        'List-Unsubscribe': `<https://asfirj.org/unsubscribe?email=${encodeURIComponent(RecipientEmail)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Mailer': 'ASFI Research Journal Platform'
      },
      ...(validCC.length > 0 && { cc: validCC.map(email => ({ email })) }),
      ...(validBCC.length > 0 && { bcc: validBCC.map(email => ({ email })) }),
      ...(attachments?.length > 0 && {
        attachment: attachments.map(file => ({
          url: file.url,
          name: escapeHtml(file.name)
        }))
      })
    };

    // Send email
    await apiInstance.sendTransacEmail(emailData);

    // Log the email in database
    await connection.execute(
      `INSERT INTO sent_emails 
       (article_id, sender, recipient, subject, status,body, sent_at, email_for) 
       VALUES (?, ?, ?, ?, 'Delivered',?, NOW(), ?)
       ON DUPLICATE KEY UPDATE 
       status = 'Delivered', sent_at = NOW()`,
      [article_id, editor_email, RecipientEmail, subject, message, email_for]
    );

    return { 
      status: "success", 
      message: "Email sent successfully",
      data: {
        recipient: RecipientEmail,
        cc: validCC,
        bcc: validBCC,
        attachments: attachments?.length || 0
      }
    };
  } catch (error) {
    console.error("Email sending error:", error);
    
    // Log the failure in database if connection exists
    if (connection) {
      try {
        await connection.execute(
          `INSERT INTO sent_emails 
           (article_id, sender, recipient, subject, status, error_message, body, sent_at, email_for) 
           VALUES (?, ?, ?, ?, 'Failed', ?, ?, NOW(), ?)`,
          [article_id, editor_email, RecipientEmail, subject, error.message.substring(0, 255), message, email_for]
        );
      } catch (dbError) {
        console.error("Failed to log error in database:", dbError);
      }
    }
    
    return { 
      status: "error", 
      message: "Failed to send email",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { ReviewerAccountEmail };