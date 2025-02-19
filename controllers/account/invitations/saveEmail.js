const db = require("../../../routes/db.config");

const saveEmailDetails = async (
  recipientEmail,
  subject,
  message,
  senderEmail,
  articleId,
  ccEmails,
  bccEmails,
  attachments,
  invitedFor
) => {
  try {
    // Check if email already exists
    const existingEmailsQuery = () =>{
      return new Promise((resolve, reject) => {
        db.query(
          "SELECT id FROM sent_emails WHERE recipient = ? AND subject = ? AND sender = ? AND article_id = ?",
          [recipientEmail, subject, senderEmail, articleId],
          (err, result) => {
            if (err) {
              console.log(err)
              reject(err);
  
            }
            else resolve(result);
          }
        );
      });
    }
    const existingEmails = await existingEmailsQuery()
    let emailId;
 
    if (existingEmails.length > 0) {
      // Email already exists, get the existing ID
      emailId = existingEmails[0].id;
    } else {
      // Save main email details only if it doesn't exist
      const emailQuery =
        "INSERT INTO sent_emails (`recipient`, `subject`, `body`, `sender`, `article_id`, `email_for`, `status`) VALUES (?, ?, ?, ?, ?, ?, 'Delivered')";
      const emailValues = [recipientEmail, subject, message, senderEmail, articleId, invitedFor];

      const emailResult = await new Promise((resolve, reject) => {
        db.query(emailQuery, emailValues, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      emailId = emailResult.insertId; // Get last inserted ID
    }

    // Only insert CC, BCC, and attachments if the email was newly saved
    if (emailId && existingEmails.length === 0) {
      // Save CC emails
      if (ccEmails && ccEmails.length > 0) {
        const ccQuery = "INSERT INTO email_cc (email_id, cc_email) VALUES ?";
        const ccValues = ccEmails.map((email) => [emailId, email]);

        await new Promise((resolve, reject) => {
          db.query(ccQuery, [ccValues], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      }

      // Save BCC emails
      if (bccEmails && bccEmails.length > 0) {
        const bccQuery = "INSERT INTO email_bcc (email_id, bcc_email) VALUES ?";
        const bccValues = bccEmails.map((email) => [emailId, email]);

        await new Promise((resolve, reject) => {
          db.query(bccQuery, [bccValues], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      }

      // Save attachments
      if (attachments && attachments.length > 0) {
        const attachmentQuery = "INSERT INTO email_attachments (email_id, file_name, file_path) VALUES ?";
        const attachmentValues = attachments.map((attachment) => [emailId, attachment.name, attachment.url]);

        await new Promise((resolve, reject) => {
          db.query(attachmentQuery, [attachmentValues], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      }
    }

    console.log("Email details saved successfully");
  } catch (error) {
    console.error("Error saving email details:", error);
    throw error;
  }
};

module.exports = saveEmailDetails;
