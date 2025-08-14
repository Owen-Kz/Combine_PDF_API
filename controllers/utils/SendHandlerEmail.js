const Brevo = require('@getbrevo/brevo');
const dotenv = require('dotenv');
const dbPromise = require('../../routes/dbPromise.config');

// Load environment variables
dotenv.config();

/**
 * Sends an email notification to the editorial handler about manuscript submissions.
 * @param {string} recipientEmail - The recipient's email address
 * @param {string} manuscriptTitle - The title of the manuscript
 * @param {string} manuscriptId - The manuscript ID
 * @param {string} userFullname - The name of the submitting author
 * @returns {Promise<Object>} - Status object with success/error information
 */
async function sendEmailToHandler(recipientEmail, manuscriptTitle, manuscriptId, userFullname) {
    // Input validation
    if (!recipientEmail || typeof recipientEmail !== 'string') {
        return { status: 'error', message: 'Invalid recipient email' };
    }

    if (!manuscriptTitle || typeof manuscriptTitle !== 'string') {
        return { status: 'error', message: 'Invalid manuscript title' };
    }

    if (!manuscriptId || typeof manuscriptId !== 'string') {
        return { status: 'error', message: 'Invalid manuscript ID' };
    }

    if (!userFullname || typeof userFullname !== 'string') {
        return { status: 'error', message: 'Invalid user fullname' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
        return { status: 'error', message: 'Invalid email format' };
    }

    try {
        // API key and sender email from environment variables
        const apiKey = process.env.BREVO_API_KEY;
        if (!apiKey) throw new Error('BREVO_API_KEY is not configured');
        
        const senderEmail = process.env.BREVO_EMAIL;
        if (!senderEmail) throw new Error('BREVO_EMAIL is not configured');

        const currentYear = new Date().getFullYear();
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Determine submission type based on manuscript ID suffix
        let submissionType = 'New submission';
        let headerText = `A new submission with the title`;
        
        if (manuscriptId.includes('.')) {
            const suffix = manuscriptId.split('.').pop().toLowerCase();
            if (suffix.startsWith('cr')) {
                submissionType = 'Correction';
                headerText = `A correction has been submitted for`;
            } else if (suffix.startsWith('r')) {
                submissionType = 'Revision';
                headerText = `A revision has been submitted for`;
            }
        }

        // Configure Brevo API
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

        // HTML email template with proper styling
        const emailContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${submissionType} Notification - ${escapeHtml(manuscriptTitle)}</title>
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
        <h2>ASFI Research Journal - ${submissionType} Notification</h2>
        <p>${currentDate}</p>
    </div>
    
    <p>Dear Editorial Team,</p>
    
    <div class="highlight">
        <p>${headerText} <strong>${escapeHtml(manuscriptTitle)}</strong> by <strong>${escapeHtml(userFullname)}</strong>.</p>
        <p>Manuscript ID: <span class="manuscript-id">${escapeHtml(manuscriptId)}</span></p>
    </div>
    
    <p>Please log in to the editorial dashboard to process this ${submissionType.toLowerCase()}.</p>
    
    <p><a href="https://asfirj.org/portal/editor/dashboard">Access Editorial Dashboard</a></p>
    
    <div class="footer">
        <p><strong>ASFIRJ Editorial Office</strong><br>
        <a href="mailto:submissions@asfirj.org">submissions@asfirj.org</a></p>
        
        <p>ASFI Research Journal<br>
        Excellence. Quality. Impact<br>
        "Raising the bar of scientific publishing in Africa"</p>
        
        <p style="margin-top: 20px;">
            <a href="https://asfirj.org/">Website</a> | 
            <a href="https://asfirj.org/contact">Contact Us</a>
        </p>
    </div>
</body>
</html>
        `;

        // Email payload
        const emailData = {
            sender: { 
                email: senderEmail, 
                name: 'ASFI Research Journal' 
            },
            to: [{ 
                email: recipientEmail, 
                name: 'Editorial Team' 
            }],
            subject: `${submissionType}: ${escapeHtml(manuscriptTitle)} (${escapeHtml(manuscriptId)})`,
            htmlContent: emailContent,
            headers: {
                'List-Unsubscribe': `<https://asfirj.org/unsubscribe?email=${encodeURIComponent(recipientEmail)}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
        };

        // Send email
        const response = await apiInstance.sendTransacEmail(emailData);
        
        return { 
            status: 'success', 
            message: 'Email notification sent successfully',
            data: {
                recipient: recipientEmail,
                submissionType,
                manuscriptId,
                messageId: response.messageId
            }
        };
    } catch (error) {
        console.error('Error sending email to handler:', error);
        return { 
            status: 'error', 
            message: 'Failed to send email notification',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
    }
}

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

module.exports = sendEmailToHandler;