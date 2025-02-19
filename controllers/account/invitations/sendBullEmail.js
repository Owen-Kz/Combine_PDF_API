const mysql = require("mysql2");
const Brevo = require("@getbrevo/brevo");
const dotenv = require("dotenv");
const db = require("../../../routes/db.config");

dotenv.config();

// Convert Quill JSON to HTML
const convertToHTML = (contentArray) => {
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

        html += `<li>${item.insert}</li>`;
      }
    } else {
      if (listOpen) {
        html += listType === "ordered" ? "</ol>" : "</ul>";
        listOpen = false;
      }

      if (item.insert.image) {
        const src = item.insert.image;
        html += `<img src="${src}" alt="Image">`;
      } else {
        let text = item.insert.replace(/\n/g, "<br>");

        if (item.attributes) {
          if (item.attributes.link) {
            text = `<a href="${item.attributes.link}">${text}</a>`;
          }
          if (item.attributes.underline) {
            text = `<u>${text}</u>`;
          }
          if (item.attributes.color) {
            text = `<span style="color:${item.attributes.color};">${text}</span>`;
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

// Send bulk email function
const sendBulkEmail = async (recipientEmail, subject, message, editorEmail, articleId, attachments) => {
  if (!recipientEmail) {
    return { status: "error", message: "Invalid Request" };
  }

  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_EMAIL;
  const currentYear = new Date().getFullYear();

  try {
    const contentArray = JSON.parse(message);
    const htmlContent = convertToHTML(contentArray);

    const emailContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <title>Email Content</title>
      </head>
      <body>
          <div>${htmlContent}</div>
          <footer><p>ASFI Research Journal (c) ${currentYear}</p></footer>
      </body>
      </html>
    `;

    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.authentications["apiKey"].apiKey = apiKey;

    const emailData = {
      sender: { email: senderEmail, name: "ASFI Research Journal" },
      to: [{ email: recipientEmail }],
      subject,
      htmlContent,
      attachment: attachments?.map((att) => ({
        content: att.content,
        name: att.name,
      })),
    };

    await apiInstance.sendTransacEmail(emailData);
const BulkEmail = async () =>{
    return new Promise((resolve, reject) =>{
        db.query(
            "UPDATE `sent_emails` SET `status` = 'Delivered' WHERE `article_id` = ? AND `sender` = ? AND `subject` = ?",
            [articleId, editorEmail, subject], async (err, data) =>{
                if(err){
                    console.log(err)
                    reject(err)
                }
                resolve(data)
            }
          );
    })
}
    await BulkEmail()

    console.log("Email sent successfully to", recipientEmail);
    return true;
  } catch (error) {
    console.error("Email sending failed:", error);
    return false;
  }
};

module.exports = { sendBulkEmail };
