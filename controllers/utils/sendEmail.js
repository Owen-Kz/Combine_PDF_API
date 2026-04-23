// backend/utils/sendEmail.js
const Brevo = require('@getbrevo/brevo');
const dotenv = require('dotenv');
const dbPromise = require('../../routes/dbPromise.config');

// Load environment variables
dotenv.config();

/**
 * Helper function to escape HTML special characters
 * @param {string} text - The text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Sends an email using Brevo API
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject
 * @param {string} options.htmlContent - HTML content of the email
 * @param {string} [options.fromName] - Sender name (defaults to 'ASFI Research Journal')
 * @param {Object} [options.attachments] - Optional attachments
 * @returns {Promise<Object>} - Status object with success/error information
 */
async function sendEmail({ to, subject, htmlContent, fromName = 'ASFI Research Journal', attachments = null }) {
    // Input validation
    if (!to) {
        return { status: 'error', message: 'No recipient specified' };
    }

    if (!subject || typeof subject !== 'string') {
        return { status: 'error', message: 'Invalid subject' };
    }

    if (!htmlContent || typeof htmlContent !== 'string') {
        return { status: 'error', message: 'Invalid email content' };
    }

    // Format recipients
    let recipients = [];
    if (Array.isArray(to)) {
        recipients = to.map(email => ({ email }));
    } else if (typeof to === 'string') {
        recipients = [{ email: to }];
    } else {
        return { status: 'error', message: 'Invalid recipients format' };
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const recipient of recipients) {
        if (!emailRegex.test(recipient.email)) {
            return { status: 'error', message: `Invalid email format: ${recipient.email}` };
        }
    }

    try {
        // API key and sender email from environment variables
        const apiKey = process.env.BREVO_API_KEY;
        if (!apiKey) throw new Error('BREVO_API_KEY is not configured');
        
        const senderEmail = process.env.BREVO_EMAIL;
        if (!senderEmail) throw new Error('BREVO_EMAIL is not configured');

        // Configure Brevo API
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

        // Prepare email data
        const emailData = {
            sender: { 
                email: senderEmail, 
                name: fromName
            },
            to: recipients,
            subject: subject,
            htmlContent: htmlContent,
            headers: {
                'List-Unsubscribe': `<https://asfirj.org/unsubscribe?email=${encodeURIComponent(recipients[0].email)}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
        };

        // Add attachments if provided
        if (attachments) {
            emailData.attachment = attachments;
        }

        // Send email
        const response = await apiInstance.sendTransacEmail(emailData);
        
        // Log the email in database with content
        await logEmailToDatabase({
            recipientCount: recipients.length,
            recipients: recipients.map(r => r.email),
            subject,
            content: htmlContent,
            status: 'sent',
            messageId: response.messageId
        });

        return { 
            status: 'success', 
            message: `Email sent successfully to ${recipients.length} recipient(s)`,
            data: {
                recipients: recipients.map(r => r.email),
                messageId: response.messageId,
                count: recipients.length
            }
        };
    } catch (error) {
        console.error('Error sending email:', error);
        
        // Log the failed email with content
        await logEmailToDatabase({
            recipientCount: recipients.length,
            recipients: recipients.map(r => r.email),
            subject,
            content: htmlContent,
            status: 'failed',
            errorMessage: error.message
        });

        return { 
            status: 'error', 
            message: 'Failed to send email',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
    }
}

/**
 * Log email to database with content
 * @param {Object} logData - Email log data
 */
async function logEmailToDatabase({ recipientCount, recipients, subject, content, status, messageId, errorMessage }) {
    try {
        const query = `
            INSERT INTO email_logs 
            (recipient_count, recipients_list, subject, content, status, message_id, error_message, sent_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        
        await dbPromise.query(query, [
            recipientCount,
            JSON.stringify(recipients),
            subject,
            content, // Store the email content
            status,
            messageId || null,
            errorMessage || null
        ]);
    } catch (dbError) {
        console.error('Error logging email to database:', dbError);
        // Don't throw - logging failure shouldn't affect email sending
    }
}

/**
 * Sends a newsletter to multiple recipients
 * @param {string[]} recipients - Array of recipient email addresses
 * @param {string} subject - Newsletter subject
 * @param {string} htmlContent - Newsletter HTML content
 * @param {string} [fromName] - Sender name
 * @returns {Promise<Object>} - Status object with success/error information
 */
async function sendNewsletter(recipients, subject, htmlContent, fromName = 'ASFI Research Journal') {
    if (!Array.isArray(recipients) || recipients.length === 0) {
        return { status: 'error', message: 'No recipients specified' };
    }

    // Split into batches of 100 to avoid API limits
    const batchSize = 100;
    const batches = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
        batches.push(recipients.slice(i, i + batchSize));
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const batch of batches) {
        const result = await sendEmail({
            to: batch,
            subject,
            htmlContent,
            fromName
        });

        results.push(result);
        if (result.status === 'success') {
            successCount += batch.length;
        } else {
            failCount += batch.length;
        }

        // Small delay between batches to avoid rate limiting
        if (batches.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return {
        status: successCount > 0 ? 'success' : 'error',
        message: `Newsletter sent: ${successCount} successful, ${failCount} failed`,
        data: {
            successCount,
            failCount,
            results
        }
    };
}

/**
 * Sends an email notification to editorial handler
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

    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // HTML email template
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
            border-left: 4px solid #ae05b4ff;
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
            color: #ae05b4ff;
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
        "Raising the bar of scientific publishing in Africa"</p>
        
        <p style="margin-top: 20px;">
            <a href="https://asfirj.org/">Website</a> | 
            <a href="https://asfirj.org/contact.html">Contact Us</a>
        </p>
    </div>
</body>
</html>
    `;

    return await sendEmail({
        to: recipientEmail,
        subject: `${submissionType}: ${escapeHtml(manuscriptTitle)} (${escapeHtml(manuscriptId)})`,
        htmlContent: emailContent,
        fromName: 'ASFI Research Journal'
    });
}

module.exports = {
    sendEmail,
    sendNewsletter,
    sendEmailToHandler,
    escapeHtml
};