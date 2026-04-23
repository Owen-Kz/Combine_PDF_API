const Brevo = require("@getbrevo/brevo");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

// Database Configuration with connection pooling
const dbConfig = {
  host: process.env.D_HOST,
  user: process.env.D_USER,
  password: process.env.D_PASSWORD,
  database: process.env.D_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
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

/**
 * Sends acceptance email to editor with proper tracking and security
 * @param {string} RecipientEmail - Email address of the recipient
 * @param {string} subject - Email subject
 * @param {string} message - Additional message content
 * @param {string} editor_email - Sender's email
 * @param {string} article_id - Related article ID
 * @param {string|Array} ccEmails - CC email addresses
 * @param {string|Array} bccEmails - BCC email addresses
 * @returns {Promise<Object>} - Status object
 */
async function AcceptanceEmailToEditor(RecipientEmail, subject, message, editor_email, article_id, ccEmails, bccEmails) {
  // Validate inputs
  if (!RecipientEmail || !subject || !article_id) {
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

    // Check if email has already been sent
    const [rows] = await connection.execute(
      `SELECT status FROM sent_emails 
       WHERE article_id = ? AND sender = ? AND subject = ? 
       AND status = 'Delivered'`,
      [article_id, editor_email, subject]
    );

    if (rows.length > 0) {
      return { 
        status: "warning", 
        message: "Email already sent",
        data: {
          recipient: RecipientEmail,
          article_id,
          first_sent: rows[0].sent_at
        }
      };
    }

    const currentYear = new Date().getUTCFullYear();
    
    // Create professional email template
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(subject)}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
          }
          .content {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 5px;
          }
          footer { 
            margin-top: 20px; 
            padding-top: 10px; 
            border-top: 1px solid #eee; 
            font-size: 0.8em; 
            color: #666; 
          }
          .article-id {
            background-color: #e3f2fd;
            padding: 5px 10px;
            border-radius: 3px;
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <div class="content">
          <p>Dear Editor,</p>
          <p>The article with ID: <span class="article-id">${escapeHtml(article_id)}</span> has been accepted by the Handling Editor and is ready for publication.</p>
          ${message ? `<p>${escapeHtml(message)}</p>` : ''}
        </div>
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
      htmlContent: emailContent,
      headers: {
        'List-Unsubscribe': `<https://asfirj.org/unsubscribe?email=${encodeURIComponent(RecipientEmail)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Mailer': 'ASFI Research Journal Platform',
        'X-Priority': '1' // High priority
      },
      ...(validCC.length > 0 && { cc: validCC.map(email => ({ email })) }),
      ...(validBCC.length > 0 && { bcc: validBCC.map(email => ({ email })) })
    };

    // Send email
    await apiInstance.sendTransacEmail(emailData);

    // Log the email in database
    await connection.execute(
      `INSERT INTO sent_emails 
       (article_id, sender, recipient, subject, status, body, sent_at) 
       VALUES (?, ?, ?, ?, 'Delivered',?, NOW())`,
      [article_id, editor_email, RecipientEmail, subject, message]
    );

    return { 
      status: "success", 
      message: "Email sent successfully",
      data: {
        recipient: RecipientEmail,
        article_id,
        cc: validCC,
        bcc: validBCC
      }
    };
  } catch (error) {
    console.error("Email sending error:", error);
    
    // Log the failure in database if connection exists
    if (connection) {
      try {
        await connection.execute(
          `INSERT INTO sent_emails 
           (article_id, sender, recipient, subject, status, error_message, body, sent_at) 
           VALUES (?, ?, ?, ?, 'Failed', ?, ?, NOW())`,
          [article_id, editor_email, RecipientEmail, subject, error.message.substring(0, 255), message]
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

module.exports = { AcceptanceEmailToEditor };