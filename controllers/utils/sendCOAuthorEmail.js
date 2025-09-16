const Brevo = require('@getbrevo/brevo');
const crypto = require('crypto');
const dotenv = require('dotenv');
const dbPromise = require('../../routes/dbPromise.config');

// Load environment variables
dotenv.config();

/**
 * Sends an email to a co-author when an account is created for them.
 * @param {string} recipientEmail - The recipient's email address.
 * @param {string} password - The temporary password generated for the co-author.
 * @returns {Promise<Object>} - Status object with success/error information.
 */
async function sendCoAuthorEmail(recipientEmail, password) {
    // Input validation
    if (!recipientEmail || !password) {
        return { status: 'error', message: 'Recipient email and password are required' };
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
        return { status: 'error', message: 'Invalid email format' };
    }

    try {
        // Fetch user details from database
        const [rows] = await dbPromise.query(
            "SELECT firstname, prefix FROM `authors_account` WHERE `email` = ?",
            [recipientEmail]
        );

        if (rows.length === 0) {
            return { status: 'error', message: 'User not found in our system' };
        }
 
        const { firstname, prefix } = rows[0];
        const currentYear = new Date().getFullYear();
        const encryptedButton = crypto.createHash('md5').update(recipientEmail).digest('hex');
        const loginUrl = `https://process.asfirj.org/verify?e=${encodeURIComponent(encryptedButton)}`;
        const updateUrl = `https://asfirj.org/portal/updateAccount?e=${encodeURIComponent(encryptedButton)}`;

        // Configure Brevo API
        const apiInstance = new Brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

        // HTML email template with proper styling
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ASFI Research Journal Account</title>
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
        .credentials { 
            background-color: #f8f9fa; 
            padding: 15px; 
            border-left: 4px solid #ae05b4ff; 
            margin: 20px 0; 
        }
        .button { 
            background-color: #ae05b4ff; 
            color: #eee; 
            padding: 12px 20px; 
            text-decoration: none; 
            border-radius: 4px; 
            display: inline-block; 
            margin: 10px 0; 
        }
        .password { 
            font-size: 1.1em; 
            font-weight: bold; 
            color: #e74c3c; 
            word-break: break-all; 
        }
        .footer { 
            font-size: 0.8em; 
            color: #7f8c8d; 
            border-top: 1px solid #eee; 
            padding-top: 15px; 
            margin-top: 30px; 
        }
        .warning { 
            color: #e74c3c; 
            font-weight: bold; 
            margin-top: 20px; 
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>Welcome to ASFI Research Journal</h2>
    </div>
    
    <p>Dear ${prefix} ${firstname},</p>
    
    <p>You've been listed as a co-author on a paper submitted to ASFI Research Journal, and an account has been created for you.</p>
    
    <div class="credentials">
        <p><strong>Your login credentials:</strong></p>
        <p><strong>Email:</strong> ${recipientEmail}</p>
        <p><strong>Temporary Password:</strong> <span class="password">${password}</span></p>
    </div>
    
    <p>Please click below to verify your account and login:</p>
    <a href="${loginUrl}" class="button" style="color:#eee;">Verify & Login</a>
    
    <p>After logging in, we strongly recommend you:</p>
    <ol>
        <li>Change your password immediately</li>
        <li>Complete your profile information</li>
    </ol>
    
    <a href="${updateUrl}" class="button" style="color:#eee;">Update Account Information</a>
    
    <p class="warning">For security reasons, please change your password immediately after first login.</p>
    
    <div class="footer">
        <p>ASFI Research Journal &copy; ${currentYear}</p>
        <p>
            <a href="https://asfirj.org/unsubscribe?email=${encodeURIComponent(recipientEmail)}">Unsubscribe</a> | 
            <a href="https://asfirj.org/contact.html">Contact Us</a>
        </p>
    </div>
</body>
</html>
        `;

        // Email payload
        const emailData = {
            sender: { 
                email: process.env.BREVO_EMAIL, 
                name: "ASFI Research Journal" 
            },
            to: [{ 
                email: recipientEmail, 
                name: `${prefix} ${firstname}` 
            }],
            subject: "Your ASFI Research Journal Co-Author Account",
            htmlContent: htmlContent,
            headers: {
                'List-Unsubscribe': `<https://asfirj.org/unsubscribe?email=${encodeURIComponent(recipientEmail)}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
        };

        // Send email
        const response = await apiInstance.sendTransacEmail(emailData);

        return { 
            status: 'success', 
            message: 'Co-author account email sent successfully',
            data: {
                recipient: recipientEmail,
                messageId: response.messageId
            }
        };
    } catch (error) {
        console.error('Error sending co-author email:', error);
        return { 
            status: 'error', 
            message: 'Failed to send email',
            error: error.message
        };
    }
}

module.exports = sendCoAuthorEmail;