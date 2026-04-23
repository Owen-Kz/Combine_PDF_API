// backend/utils/SendPublicationEmail.js
require("dotenv").config();

const Brevo = require("@getbrevo/brevo");
// const dbPromise = require("../../journal.db");
const { escapeHtml } = require("./security");
const fs = require('fs');
const path = require('path');
const dbPromise = require("../../routes/journal.db");
const db = require("../../routes/db.config");

/**
 * Sends a publication confirmation email to authors after manuscript is published
 * @param {string} recipientEmail - Corresponding author's email address
 * @param {string} manuscriptTitle - Title of the published manuscript
 * @param {string} manuscriptId - Unique manuscript ID/buffer
 * @param {string} issueNumber - Issue number where manuscript is published
 * @param {string} fileName - PDF filename to attach
 * @param {string} authorName - Author's name for personalization (optional)
 * @returns {Promise<Object>} - Status object with success/error information
 */
const SendPublicationEmail = async (recipientEmail, manuscriptTitle, manuscriptId, issueNumber, fileName, authorName = "") => {
    // Input validation
    if (!recipientEmail || typeof recipientEmail !== "string") {
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

    if (!issueNumber || typeof issueNumber !== "string") {
        console.error("Invalid issue number");
        return { status: "error", message: "Invalid issue number" };
    }

    if (!fileName || typeof fileName !== "string") {
        console.error("Invalid file name");
        return { status: "error", message: "Invalid file name" };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
        console.error("Invalid email format");
        return { status: "error", message: "Invalid email format" };
    }

    try {
        // If authorName is not provided, try to fetch from database
        let authorDisplayName = authorName;
        if (!authorDisplayName) {
            const result = await new Promise((resolve, reject) => {
                db.query(
                    "SELECT prefix, firstname, lastname FROM `authors_account` WHERE `email` = ?", 
                    [recipientEmail], 
                    (err, results) => {
                        if (err) reject(err);
                        else resolve(results);
                    }
                );
            });

            if (result.length > 0) {
                const { prefix, firstname, lastname } = result[0];
                authorDisplayName = `${prefix ? prefix + ' ' : ''}${firstname || ''} ${lastname || ''}`.trim();
            } else {
                // Use email username as fallback
                authorDisplayName = recipientEmail.split('@')[0];
            }
        }

        // Clean and personalize the manuscript title for the URL
        const cleanTitle = encodeURIComponent(manuscriptTitle.toLowerCase().replace(/\s+/g, '-'));
        const articleUrl = `https://asfirj.org/content?sid=${manuscriptId}&title=${cleanTitle}`;
        
        // Get the full path to the PDF file
        const pdfPath = path.join(__dirname, './../../useruploads/manuscripts', fileName);
        
        // Check if file exists
        if (!fs.existsSync(pdfPath)) {
            console.error(`PDF file not found: ${pdfPath}`);
            return { status: "error", message: "PDF file not found" };
        }

        // Read the PDF file as base64 for attachment
        const pdfContent = fs.readFileSync(pdfPath);
        const base64PDF = pdfContent.toString('base64');

        // Configure Brevo API
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(
            Brevo.TransactionalEmailsApiApiKeys.apiKey,
            process.env.BREVO_API_KEY
        );

        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const currentYear = new Date().getUTCFullYear();

        // HTML email template matching PHP version
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Paper Has Been Published - ${escapeHtml(manuscriptTitle)}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
        }
        h2 {
            color: #7b306c;
        }
        .button {
            background-color: #7b306c;
            color: #fff;
            padding: 10px 15px;
            text-decoration: none;
            border-radius: 4px;
            display: inline-block;
            margin: 20px 0;
        }
        .button:hover {
            background-color: #501f46;
        }
        .footer {
            margin-top: 30px;
            font-size: 0.9em;
            color: #7f8c8d;
            border-top: 1px solid #eee;
            padding-top: 15px;
        }
        .footer a {
            color: #7b306c;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        .unsubscribe {
            font-size: 0.8em;
            color: #7f8c8d;
        }
        .unsubscribe a {
            color: #7f8c8d;
        }
        .manuscript-id {
            font-weight: bold;
            color: #e74c3c;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Congratulations, ${escapeHtml(authorDisplayName)}!</h2>
        
        <p>Your paper, <strong>"${escapeHtml(manuscriptTitle)}"</strong>, has now been officially published in <em>ASFI Research Journal</em>, Issue ${escapeHtml(issueNumber)}.</p>
        
        <p>Manuscript ID: <span class="manuscript-id">${escapeHtml(manuscriptId)}</span></p>
        
        <p style="margin: 20px 0;">
            <a href="${articleUrl}" class="button" target="_blank" style="color:#fff;" rel="noopener noreferrer">View Your Published Paper</a>
        </p>
        
        <p>We've attached a complimentary PDF copy for your records and to share with co-authors.</p>
        
        <p>This publication contributes to our shared mission of advancing research in your field. We're honored to have your work in ASFIRJ.</p>
        
        <div class="footer">
            <p>ASFI Research Journal Editorial Team<br>
            <a href="https://asfirj.org" target="_blank" rel="noopener noreferrer">asfirj.org</a></p>
            
            <p class="unsubscribe">
                <a href="https://asfirj.org/unsubscribe?email=${encodeURIComponent(recipientEmail)}" target="_blank" rel="noopener noreferrer">Unsubscribe</a> | 
                <a href="https://asfirj.org/contact" target="_blank" rel="noopener noreferrer">Contact Us</a>
            </p>
        </div>
    </div>
</body>
</html>
        `;

        // Email configuration with attachment
        const email = {
            sender: { 
                email: process.env.BREVO_EMAIL, 
                name: "ASFI Research Journal" 
            },
            to: [{ 
                email: recipientEmail, 
                name: authorDisplayName 
            }],
            subject: `Your Paper "${manuscriptTitle}" Has Been Published in ASFIRJ (Issue ${issueNumber})`,
            htmlContent: htmlContent,
            attachment: [{
                content: base64PDF,
                name: fileName
            }],
            headers: {
                'List-Unsubscribe': `<https://asfirj.org/unsubscribe?email=${encodeURIComponent(recipientEmail)}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
        };

        // Send email via Brevo
        const response = await apiInstance.sendTransacEmail(email);
        
        console.log(`Publication email sent successfully to ${recipientEmail} for manuscript ${manuscriptId}`);
        
        // Log the email sending in database
        await new Promise((resolve, reject) => {
            dbPromise.query(
                "INSERT INTO email_logs (recipient_email, manuscript_id, email_type, status, sent_at) VALUES (?, ?, 'publication', 'sent', NOW())",
                [recipientEmail, manuscriptId],
                (err, result) => {
                    if (err) {
                        console.error("Error logging email:", err);
                        resolve(); // Don't fail if logging fails
                    } else {
                        resolve(result);
                    }
                }
            );
        });

        return { 
            status: "success", 
            message: "Publication email sent successfully",
            data: {
                recipient: recipientEmail,
                manuscriptId,
                issueNumber,
                messageId: response.messageId
            }
        };

    } catch (error) {
        console.error("Error sending publication email:", error);
        
        // Log the failure in database
        try {
            await new Promise((resolve, reject) => {
                dbPromise.query(
                    "INSERT INTO email_logs (recipient_email, manuscript_id, email_type, status, error_message, sent_at) VALUES (?, ?, 'publication', 'failed', ?, NOW())",
                    [recipientEmail, manuscriptId, error.message || "Unknown error"],
                    (err, result) => {
                        if (err) console.error("Error logging email failure:", err);
                        resolve();
                    }
                );
            });
        } catch (logError) {
            console.error("Error logging email failure:", logError);
        }

        return { 
            status: "error", 
            message: "Failed to send publication email",
            error: error.message,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        };
    }
};

module.exports = SendPublicationEmail;