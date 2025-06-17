const Brevo = require('@getbrevo/brevo'); 
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Sends an email notification using Brevo (Sendinblue).
 * @param {string} recipientEmail - The recipient's email address.
 * @param {string} manuscriptTitle - The title of the manuscript.
 * @param {string} manuscriptId - The manuscript ID.
 */
async function sendEmailToHandler(recipientEmail, manuscriptTitle, manuscriptId) {
    try {
        if (!recipientEmail) {
            return { status: 'error', message: 'Invalid Request' };
        }

        // API key and sender email from environment variables
        const apiKey = process.env.BREVO_API_KEY;
        const senderEmail = process.env.BREVO_EMAIL;
        const recipientName = "submissions@asfirj.org";

        // Configure Brevo API
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

        // Email content
        const emailContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Submission Confirmation - ${manuscriptTitle}</title>
            </head>
            <body>
                <p>${new Date().toDateString()}</p>

                <p>Dear ${recipientName},</p>

                <p>A new submission with the title <strong>${manuscriptTitle}</strong> has just been made.</p>
                
                <p>Manuscript ID is <strong>[${manuscriptId}]</strong>.</p>

                <p>Sincerely,</p>

                <p>ASFIRJ Editorial Office<br>
                <a href="mailto:submissions@asfirj.org">submissions@asfirj.org</a></p>

                <p>ASFI Research Journal<br>
                Excellence. Quality. Impact<br>
                "Raising the bar of scientific publishing in Africa"<br>
                <a href="https://asfirj.org/">https://asfirj.org/</a><br>
                <a href="mailto:asfirj@asfirj.org">asfirj@asfirj.org</a><br>
                LinkedIn: <a href="https://www.linkedin.com/in/asfi-research-journal-1b9929309">www.linkedin.com/in/asfi-research-journal-1b9929309</a><br>
                X (formerly Twitter): <a href="https://twitter.com/asfirj1">https://twitter.com/asfirj1</a><br>
                Instagram: <a href="https://www.instagram.com/asfirj1/">https://www.instagram.com/asfirj1/</a><br>
                WhatsApp: <a href="https://chat.whatsapp.com/L8o0N0pUieOGIUHJ1hjSG3">https://chat.whatsapp.com/L8o0N0pUieOGIUHJ1hjSG3</a></p>
            </body>
            </html>
        `;

        // Email payload
        const emailData = {
            sender: { email: senderEmail, name: 'ASFI Research Journal' },
            to: [{ email: recipientEmail, name: recipientName }],
            subject: `${manuscriptTitle} (${manuscriptId})`,
            htmlContent: emailContent
        };

        // Send email
        const response = await apiInstance.sendTransacEmail(emailData);
        return { status: 'success', message: 'Email sent', response };
    } catch (error) {
        return { status: 'error', message: `Error: ${error.message}` };
    }
}

module.exports = sendEmailToHandler;
