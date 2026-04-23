const Brevo = require("@getbrevo/brevo");
const mysql = require("mysql2/promise");
const axios = require("axios");
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

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Initialize Brevo API
const senderEmail = process.env.BREVO_EMAIL;
const apiKey = process.env.BREVO_API_KEY;
const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

// HTML escaping function to prevent XSS
const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Downloads a file from URL and returns it as base64
 */
async function downloadFileAsBase64(url, fileName) {
  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024
    });

    const base64Data = Buffer.from(response.data, 'binary').toString('base64');
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    const fileSize = response.headers['content-length'] || response.data.length;
    
    return {
      content: base64Data,
      name: fileName,
      contentType: contentType,
      size: fileSize,
      url: url
    };
  } catch (error) {
    console.error(`Error downloading file ${fileName} from ${url}:`, error.message);
    throw new Error(`Failed to download attachment: ${fileName}`);
  }
}

/**
 * Validates email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Process message content - handles both string and object
 */
function processMessageContent(message) {
  if (!message) return '';
  
  try {
    if (typeof message === 'string') {
      if (message.startsWith('[') || message.startsWith('{')) {
        try {
          const parsed = JSON.parse(message);
          return convertToHTML(parsed);
        } catch {
          return message;
        }
      }
      return message;
    }
    
    if (typeof message === 'object') {
      if (message.ops) {
        return convertToHTML(message.ops);
      }
      if (Array.isArray(message)) {
        return convertToHTML(message);
      }
    }
    
    return String(message);
  } catch (error) {
    console.error("Error processing message content:", error);
    return String(message);
  }
}

// Convert Quill Delta JSON to HTML
function convertToHTML(contentArray) {
  if (!contentArray || !Array.isArray(contentArray)) {
    return '';
  }

  let html = "";
  let listOpen = false;
  let listType = "";

  contentArray.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    
    const insert = item.insert || '';
    
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
        
        html += `<li>${escapeHtml(insert)}</li>`;
      }
    } else {
      if (listOpen) {
        html += listType === "ordered" ? "</ol>" : "</ul>";
        listOpen = false;
      }

      if (insert && typeof insert === 'object' && insert.image) {
        const src = escapeHtml(insert.image);
        html += `<img src="${src}" alt="Image" style="max-width:100%;height:auto;">`;
      } else {
        let text = escapeHtml(insert).replace(/\n/g, "<br>");
        
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
          if (item.attributes.italic) text = `<em>${text}</em>`;
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
 */
async function ReviewerAccountEmail(RecipientEmail, subject, message, editor_email, article_id, ccEmails, bccEmails, attachments, email_for) {
  // Validate inputs
  if (!RecipientEmail || !subject || !message) {
    return { status: "error", message: "Missing required fields" };
  }

  if (!isValidEmail(RecipientEmail)) {
    return { status: "error", message: "Invalid recipient email format" };
  }

  let connection;
  let emailId = null;
  let processedAttachments = [];

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Process CC and BCC emails
    const processEmailList = (emails) => {
      if (!emails) return [];
      const emailArray = typeof emails === 'string' ? emails.split(',').filter(e => e.trim()) : (Array.isArray(emails) ? emails : []);
      return emailArray
        .map(email => String(email).trim())
        .filter(email => isValidEmail(email));
    };

    const validCC = processEmailList(ccEmails);
    const validBCC = processEmailList(bccEmails);

    // Process message content
    const htmlContent = processMessageContent(message);
    const currentYear = new Date().getUTCFullYear();
    const unsubscribeUrl = `https://asfirj.org/unsubscribe?email=${encodeURIComponent(RecipientEmail)}`;

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
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        ${htmlContent}
        <footer>
          <p>ASFI Research Journal &copy; ${currentYear}</p>
          <p>
            <a href="${unsubscribeUrl}" style="color:#666; text-decoration:underline;">
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
        email: senderEmail, 
        name: "ASFI Research Journal" 
      },
      to: [{ email: RecipientEmail }],
      subject: escapeHtml(subject),
      htmlContent: emailTemplate,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Mailer': 'ASFI Research Journal Platform',
        'List-Id': 'asfirj.org',
        'Precedence': 'bulk'
      }
    };

    // Add CC if present
    if (validCC.length > 0) {
      emailData.cc = validCC.map(email => ({ email }));
    }

    // Add BCC if present
    if (validBCC.length > 0) {
      emailData.bcc = validBCC.map(email => ({ email }));
    }

    // Process attachments - download files and attach content
    if (attachments && attachments.length > 0) {
      for (const file of attachments) {
        try {
          if (file.url) {
            console.log(`Downloading attachment: ${file.name} from ${file.url}`);
            const downloadedFile = await downloadFileAsBase64(file.url, file.name);
            processedAttachments.push({
              content: downloadedFile.content,
              name: downloadedFile.name,
              contentType: downloadedFile.contentType,
              size: downloadedFile.size,
              url: file.url // Store the original URL
            });
          } else if (file.content) {
            processedAttachments.push({
              content: file.content,
              name: file.name,
              contentType: file.mimetype || 'application/octet-stream',
              size: file.size || 0,
              url: file.url || null
            });
          }
        } catch (error) {
          console.error(`Failed to process attachment ${file.name}:`, error.message);
        }
      }

      if (processedAttachments.length > 0) {
        emailData.attachment = processedAttachments.map(att => ({
          content: att.content,
          name: att.name,
          contentType: att.contentType
        }));
      }
    }

    // Send email with timeout
    const sendPromise = apiInstance.sendTransacEmail(emailData);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email sending timeout after 30 seconds')), 30000)
    );

    await Promise.race([sendPromise, timeoutPromise]);

    // Insert into sent_emails and get the email_id
    const [emailResult] = await connection.execute(
      `INSERT INTO sent_emails 
       (article_id, sender, recipient, subject, status, body, sent_at, email_for) 
       VALUES (?, ?, ?, ?, 'Delivered', ?, NOW(), ?)`,
      [
        article_id, 
        editor_email, 
        RecipientEmail, 
        // validCC.join(', '), 
        // validBCC.join(', '), 
        subject, 
        JSON.stringify({ message: htmlContent.substring(0, 1000) }),
        email_for
      ]
    );

    emailId = emailResult.insertId;

    // Insert CC emails into email_cc table
    if (validCC.length > 0) {
      const ccPromises = validCC.map(ccEmail => 
        connection.execute(
          `INSERT INTO email_cc (email_id, cc_email) VALUES (?, ?)`,
          [emailId, ccEmail]
        )
      );
      await Promise.all(ccPromises);
    }

    // Insert BCC emails into email_bcc table
    if (validBCC.length > 0) {
      const bccPromises = validBCC.map(bccEmail => 
        connection.execute(
          `INSERT INTO email_bcc (email_id, bcc_email) VALUES (?, ?)`,
          [emailId, bccEmail]
        )
      );
      await Promise.all(bccPromises);
    }

    // Insert attachments into email_attachments table
    if (processedAttachments.length > 0) {
      const attachmentPromises = processedAttachments.map(att => 
        connection.execute(
          `INSERT INTO email_attachments (email_id, file_name, file_path, file_size, mime_type) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            emailId, 
            att.name, 
            att.url || 'embedded', 
            att.size || 0, 
            att.contentType || 'application/octet-stream'
          ]
        )
      );
      await Promise.all(attachmentPromises);
    }

    await connection.commit();

    return { 
      status: "success", 
      message: "Email sent successfully",
      data: {
        emailId: emailId,
        recipient: RecipientEmail,
        cc: validCC,
        bcc: validBCC,
        attachments: processedAttachments.length
      }
    };

  } catch (error) {
    console.error("Email sending error:", error);
    
    if (connection) {
      await connection.rollback();
      
      // Log the failure in database
      try {
        const [failedEmailResult] = await connection.execute(
          `INSERT INTO sent_emails 
           (article_id, sender, recipient, subject, status, error_message, body, sent_at, email_for) 
           VALUES (?, ?, ?, ?, 'Failed', ?, ?, NOW(), ?)`,
          [
            article_id, 
            editor_email, 
            RecipientEmail, 
            // Array.isArray(ccEmails) ? ccEmails.join(', ') : ccEmails || '',
            // Array.isArray(bccEmails) ? bccEmails.join(', ') : bccEmails || '',
            subject, 
            error.message?.substring(0, 255) || 'Unknown error',
            JSON.stringify({ message: String(message).substring(0, 1000) }),
            email_for
          ]
        );
        
        emailId = failedEmailResult.insertId;
      } catch (dbError) {
        console.error("Failed to log error in database:", dbError);
      }
    }
    
    return { 
      status: "error", 
      message: "Failed to send email",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
      emailId: emailId
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { ReviewerAccountEmail };