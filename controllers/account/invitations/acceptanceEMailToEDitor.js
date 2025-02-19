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

// Function to send acceptance email
async function AcceptanceEmailToEditor(RecipientEmail, subject, message, editor_email, article_id, ccEmails, bccEmails) {
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

    const currentYear = new Date().getFullYear();
    const emailContent = `
      <html>
        <head><title>Email Content</title></head>
        <body>
          <div>
            <p>Article With Id: <b>${article_id}</b> has been accepted by the Handling editor and is ready for publication</p>
          </div>
          <footer><p>ASFI Research Journal (c) ${currentYear}</p></footer>
        </body>
      </html>
    `;

    const emailData = {
      sender: { email: senderEmail, name: "ASFI Research Journal" },
      to: [{ email: RecipientEmail }],
      subject,
      htmlContent: emailContent,
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

module.exports = { AcceptanceEmailToEditor };
