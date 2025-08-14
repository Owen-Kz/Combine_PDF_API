require("dotenv").config();

const Brevo = require("@getbrevo/brevo");
const db = require("../../routes/db.config");

/**
 * Sends an email reminder to a recipient
 * @param {string} RecipientEmail - The recipient's email address
 * @param {string} subject - The email subject
 * @param {string} emailContent - The HTML content of the email
 * @returns {Promise<Object>} - Status object with success/error information
 */
const sendEmailReminder = async (RecipientEmail, subject, emailContent) => {
    // Validate inputs
    if (!RecipientEmail || typeof RecipientEmail !== "string") {
        console.error("Invalid recipient email");
        return { status: "error", message: "Invalid recipient email" };
    }

    if (!subject || typeof subject !== "string") {
        console.error("Invalid email subject");
        return { status: "error", message: "Invalid email subject" };
    }

    if (!emailContent || typeof emailContent !== "string") {
        console.error("Invalid email content");
        return { status: "error", message: "Invalid email content" };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(RecipientEmail)) {
        console.error("Invalid email format");
        return { status: "error", message: "Invalid email format" };
    }

    try {
        // Brevo API Configuration
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(
            Brevo.TransactionalEmailsApiApiKeys.apiKey,
            process.env.BREVO_API_KEY
        );

        // Current year for footer
        const currentYear = new Date().getFullYear();

        // HTML email template with proper styling
        const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
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
        .header {
            color: #2c3e50;
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .content {
            margin: 20px 0;
        }
        .footer {
            font-size: 0.8em;
            color: #7f8c8d;
            border-top: 1px solid #eee;
            padding-top: 15px;
            margin-top: 30px;
        }
        a {
            color: #3498db;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>ASFI Research Journal</h2>
    </div>
    
    <div class="content">
        ${emailContent}
    </div>
    
    <div class="footer">
        <p>ASFI Research Journal &copy; ${currentYear}</p>
        <p>
            <a href="https://asfirj.org/unsubscribe?email=${encodeURIComponent(RecipientEmail)}">Unsubscribe</a> | 
            <a href="https://asfirj.org/contact">Contact Us</a>
        </p>
    </div>
</body>
</html>
        `;

        // Email configuration
        const email = {
            sender: { 
                email: process.env.BREVO_EMAIL, 
                name: "ASFI Research Journal" 
            },
            to: [{ email: RecipientEmail }],
            subject: escapeHtml(subject),
            htmlContent: htmlTemplate,
            headers: {
                'List-Unsubscribe': `<https://asfirj.org/unsubscribe?email=${encodeURIComponent(RecipientEmail)}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
        };

        // Send email
        const response = await apiInstance.sendTransacEmail(email);
        
        console.log(`Email sent successfully to ${RecipientEmail}`);
        return { 
            status: "success", 
            message: "Email sent successfully",
            data: {
                recipient: RecipientEmail,
                messageId: response.messageId
            }
        };
    } catch (error) {
        console.error("Email sending error:", error);
        return { 
            status: "error", 
            message: "Email sending failed",
            error: error.message,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        };
    }
};

/**
 * Helper function to escape HTML special characters
 * @param {string} text - The text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

module.exports = sendEmailReminder;