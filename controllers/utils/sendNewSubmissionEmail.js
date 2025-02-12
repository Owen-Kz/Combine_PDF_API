require("dotenv").config();

const Brevo = require("@getbrevo/brevo");
const db = require("../../routes/db.config");

const SendNewSubmissionEmail = async (RecipientEmail, manuscriptTitle, manuscriptId) => {
    if (!RecipientEmail) {
        return ({ status: "error", message: "Invalid Request" });
    }

    // Fetch author details from database
    db.query("SELECT * FROM `authors_account` WHERE `email` = ?", [RecipientEmail], async (err, result) => {
        if (err) {
            console.error("Database error:", err);
            return ({ status: "error", message: "Database error", details: err.message });
        }

        if (result.length === 0) {
            return ({ status: "error", message: "User does not exist on our servers" });
        }

        const { prefix, firstname: RecipientName } = result[0];

        // Brevo API Configuration
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

        // Email content
        const email = {
            sender: { email: process.env.BREVO_EMAIL, name: "ASFI Research Journal" },
            to: [{ email: RecipientEmail, name: RecipientName }],
            subject: `${manuscriptTitle} (${manuscriptId})`,
            htmlContent: `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Submission Confirmation - ${manuscriptTitle}</title>
                </head>
                <body>
                    <p>${new Date().toDateString()}</p>
                    <p>Dear ${prefix} ${RecipientName},</p>
                    <p>Your manuscript has been successfully submitted and is under review.</p>
                    <p>Your manuscript ID is <strong>[${manuscriptId}]</strong>.</p>
                    <p>Log in to track your submission: <a href="https://asfirj.org/portal/login/">ASFIRJ Portal</a></p>
                    <p>Best regards, <br> ASFIRJ Editorial Office</p>
                </body>
                </html>
            `,
        };

        try {
            // Send email
            await apiInstance.sendTransacEmail(email);
            return ({ status: "success", message: "Email sent successfully" });
        } catch (error) {
            console.error("Email sending error:", error);
            return ({ status: "error", message: `Email sending failed: ${error.message}` });
        }
    });
};

module.exports = SendNewSubmissionEmail;
