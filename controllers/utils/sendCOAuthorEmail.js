const Brevo = require('@getbrevo/brevo');

const crypto = require('crypto');
const dotenv = require('dotenv');
const db = require('../../routes/db.config');

// Load environment variables
dotenv.config();

/**
 * Sends an email to a co-author when an account is created for them.
 * @param {string} recipientEmail - The recipient's email address.
 * @param {string} password - The password generated for the co-author.
 */
async function sendCoAuthorEmail(recipientEmail, password) {
    if (!recipientEmail || !password) {
        return { status: 'error', message: 'Invalid Request' };
    }

    try {
        // Fetch user details from database
        const [rows] = await db.query(
            "SELECT * FROM `authors_account` WHERE `email` = ?",
            [recipientEmail]
        );

        if (rows.length === 0) {
            return { status: 'error', message: 'User does not exist on our servers' };
        }

        const { firstname, prefix } = rows[0];
        const encryptedButton = crypto.createHash('md5').update(recipientEmail).digest('hex');

        // Configure Brevo API
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

        const senderEmail = process.env.BREVO_EMAIL;
        const subject = "ASFI Research Journal Account Created";
        const htmlContent = `
            <h2>Hi, ${prefix} ${firstname}</h2>
            <p>A paper was submitted listing you as a co-author, and an account has been created for you with the following details:</p>
            <ul>
                <li>Email: <b>${recipientEmail}</b></li>
                <li>Password: <b>${password}</b></li>
            </ul>
            <p><a href="https://process.asfirj.org/verify?e=${encryptedButton}">Click here</a> to verify your account and login.</p>
            <p>Or paste this link in your browser: <a href="https://process.asfirj.org/verify?e=${encryptedButton}">https://process.asfirj.org/verify?e=${encryptedButton}</a></p>
            <p>You can update your password and other required information here: <a href="https://asfirj.org/portal/updateAccount?e=${encryptedButton}">https://asfirj.org/portal/updateAccount?e=${encryptedButton}</a></p>
        `;

        // Email payload
        const emailData = {
            sender: { email: senderEmail, name: "ASFI Research Journal" },
            to: [{ email: recipientEmail, name: firstname }],
            subject: subject,
            htmlContent: htmlContent
        };

        // Send email
        const response = await apiInstance.sendTransacEmail(emailData);

        return { status: 'success', message: 'Email sent', response };
    } catch (error) {
        return { status: 'error', message: `Error: ${error.message}` };
    }
}

module.exports = sendCoAuthorEmail;
