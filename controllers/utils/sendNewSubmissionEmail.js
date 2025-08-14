require("dotenv").config();

const Brevo = require("@getbrevo/brevo");
const db = require("../../routes/db.config");
const { escapeHtml } = require("./security");

/**
 * Sends a confirmation email to authors after manuscript submission
 * @param {string} RecipientEmail - Author's email address
 * @param {string} manuscriptTitle - Title of the submitted manuscript
 * @param {string} manuscriptId - Unique manuscript ID
 * @returns {Promise<Object>} - Status object with success/error information
 */
const SendNewSubmissionEmail = async (RecipientEmail, manuscriptTitle, manuscriptId) => {
    // Input validation
    if (!RecipientEmail || typeof RecipientEmail !== "string") {
        console.error("Invalid recipient email");
        return { status: "error", message: "Invalid recipient email" };
    }

    if (!manuscriptTitle || typeof manuscriptTitle !== "string") {
        console.error("Invalid manuscript title");
        return { status: "error", message: "Invalid manuscript title" };
    }

    if (!manuscriptId || typeof manuscriptId !== "string") {
        console.error("Invalid manuscript ID");
        return { status: "error", message: "Invalid manuscript ID" };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(RecipientEmail)) {
        console.error("Invalid email format");
        return { status: "error", message: "Invalid email format" };
    }

    try {
        // Convert callback-based db.query to promise
        const result = await new Promise((resolve, reject) => {
            db.query(
                "SELECT prefix, firstname FROM `authors_account` WHERE `email` = ?", 
                [RecipientEmail], 
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });

        if (result.length === 0) {
            console.error("User not found in database");
            return { status: "error", message: "Author not found in our system" };
        }

        const { prefix, firstname: RecipientName } = result[0];
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const currentYear = new Date().getFullYear();

        // Configure Brevo API
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(
            Brevo.TransactionalEmailsApiApiKeys.apiKey,
            process.env.BREVO_API_KEY
        );

        // HTML email template with proper styling
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Submission Confirmation - ${escapeHtml(manuscriptTitle)}</title>
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
        .highlight {
            background-color: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #3498db;
            margin: 20px 0;
        }
        .manuscript-id {
            font-weight: bold;
            color: #e74c3c;
        }
        .button {
            background-color: #3498db;
            color: white;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 4px;
            display: inline-block;
            margin: 10px 0;
        }
        .footer {
            font-size: 0.8em;
            color: #7f8c8d;
            border-top: 1px solid #eee;
            padding-top: 15px;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Submission Confirmation</h2>
        <p>${currentDate}</p>
    </div>
    
    <p>Dear ${escapeHtml(prefix)} ${escapeHtml(RecipientName)},</p>
    
    <div class="highlight">
        <p>Your manuscript <strong>${escapeHtml(manuscriptTitle)}</strong> has been successfully submitted to ASFI Research Journal and is now under review.</p>
        <p>Manuscript ID: <span class="manuscript-id">${escapeHtml(manuscriptId)}</span></p>
    </div>
    
    <p>You can track your submission status through our author portal:</p>
    
    <a href="https://asfirj.org/portal/login/" class="button">Access Author Portal</a>
    
    <p>We will notify you by email when there are updates to your submission status.</p>
    
    <div class="footer">
        <p>ASFI Research Journal &copy; ${currentYear}</p>
        <p>
            <a href="https://asfirj.org/contact">Contact Us</a> | 
            <a href="https://asfirj.org/faq">Author FAQ</a>
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
            to: [{ 
                email: RecipientEmail, 
                name: `${prefix} ${RecipientName}` 
            }],
            subject: `Submission Confirmation: ${escapeHtml(manuscriptTitle)} (${escapeHtml(manuscriptId)})`,
            htmlContent: htmlContent,
            headers: {
                'List-Unsubscribe': `<https://asfirj.org/unsubscribe?email=${encodeURIComponent(RecipientEmail)}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
        };

        // Send email
        const response = await apiInstance.sendTransacEmail(email);
        
        console.log(`Submission confirmation sent to ${RecipientEmail}`);
        return { 
            status: "success", 
            message: "Submission confirmation email sent successfully",
            data: {
                recipient: RecipientEmail,
                manuscriptId,
                messageId: response.messageId
            }
        };
    } catch (error) {
        console.error("Error sending submission confirmation:", error);
        return { 
            status: "error", 
            message: "Failed to send submission confirmation",
            error: error.message,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        };
    }
};

module.exports = SendNewSubmissionEmail;