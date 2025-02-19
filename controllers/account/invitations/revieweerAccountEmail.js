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
};

// Initialize Brevo API
const senderEmail = process.env.BREVO_EMAIL;
const apiKey = process.env.BREVO_API_KEY;
const apiInstance = new Brevo.TransactionalEmailsApi();
apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

// Convert Quill Delta JSON to HTML
function convertToHTML(contentArray) {
  let html = "";
  let listOpen = false;

  for (const item of contentArray) {
    if (item.attributes?.list) {
      if (!listOpen) {
        html += item.attributes.list === "ordered" ? "<ol>" : "<ul>";
        listOpen = true;
      }
      html += `<li>${item.insert}</li>`;
    } else {
      if (listOpen) {
        html += item.attributes?.list === "ordered" ? "</ol>" : "</ul>";
        listOpen = false;
      }

      if (item.insert.image) {
        html += `<img src="${item.insert.image}" alt="Image">`;
      } else {
        let text = item.insert.replace(/\n/g, "<br>");
        if (item.attributes) {
          if (item.attributes.link) text = `<a href="${item.attributes.link}">${text}</a>`;
          if (item.attributes.underline) text = `<u>${text}</u>`;
          if (item.attributes.color) text = `<span style="color:${item.attributes.color}">${text}</span>`;
          if (item.attributes.bold) text = `<strong>${text}</strong>`;
        }
        html += text;
      }
    }
  }

  if (listOpen) {
    html += "</ul>";
  }
  return html;
}

// Function to send email via Brevo
async function ReviewerAccountEmail(RecipientEmail, subject, message, editor_email, article_id, ccEmails, bccEmails, attachments) {
  if (!RecipientEmail) {
    return { status: "error", message: "Invalid Request" };
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);

    // **Check if email has already been sent**
    const [rows] = await connection.execute(
      "SELECT status FROM `sent_emails` WHERE `article_id` = ? AND `sender` = ? AND `subject` = ?",
      [article_id, editor_email, subject]
    );

    if (rows.length > 0 && rows[0].status === "Delivered") {
      await connection.end();
      return { status: "warning", message: "Email already sent" };
    }

    const contentArray = JSON.parse(message);
    const htmlContent = convertToHTML(contentArray);
    const currentYear = new Date().getFullYear();

    const emailContent = `
      <html>
        <head><title>Email Content</title></head>
        <body>
          <div>${htmlContent}</div>
          <footer><p>ASFI Research Journal (c) ${currentYear}</p></footer>
        </body>
      </html>
    `;

    // Prepare email data
    const emailData = {
      sender: { email: senderEmail, name: "ASFI Research Journal" },
      to: [{ email: RecipientEmail }],
      subject,
      htmlContent: emailContent,
      ...(ccEmails?.length && { cc: ccEmails.split(",").map((email) => ({ email })) }),
      ...(bccEmails?.length && { bcc: bccEmails.split(",").map((email) => ({ email })) }),
      ...(attachments?.length && {
        attachment: attachments.map((file) => ({
          url: file.url,
          name: file.name,
        })),
      }),
    };

    await apiInstance.sendTransacEmail(emailData);

    // **Update database status after sending**
    // await connection.execute(
    //   "INSERT INTO `sent_emails` (`article_id`, `sender`, `subject`, `status`) VALUES (?, ?, ?, 'Delivered') ON DUPLICATE KEY UPDATE `status` = 'Delivered'",
    //   [article_id, editor_email, subject]
    // );

    await connection.end();
    return { status: "success", message: "Email sent successfully" };
  } catch (error) {
    console.error("Brevo API Error:", error.message);
    if (connection) await connection.end();
    return { status: "error", message: error.message };
  }
}

module.exports = { ReviewerAccountEmail };
