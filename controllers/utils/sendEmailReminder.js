require("dotenv").config();

const Brevo = require("@getbrevo/brevo");
const db = require("../../routes/db.config");

const sendEmailReminder = async (RecipientEmail, subject, emailContent) => {
    if (!RecipientEmail) {
        console.log("Invalied Request")
        return ({ status: "error", message: "Invalid Request" });
    }


        // Brevo API Configuration
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

        // Email content
        const email = {
            sender: { email: process.env.BREVO_EMAIL, name: "ASFI Research Journal" },
            to: [{ email: RecipientEmail}],
            subject: `${subject}`,
            htmlContent: `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${subject}</title>
                </head>
                <body>
                 ${emailContent}
                 <p>ASFIRJ </p>
                </body>
                </html>
            `,
        };

        try {
            // Send email
            await apiInstance.sendTransacEmail(email);
            console.log("email Sent")
            return ({ status: "success", message: "Email sent successfully" });
        } catch (error) {
            console.error("Email sending error:", error);
            return ({ status: "error", message: `Email sending failed: ${error.message}` });
        }

};

module.exports = sendEmailReminder;
