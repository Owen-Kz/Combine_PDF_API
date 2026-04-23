// controllers/invitations/sendConfirmationEmail.js
const Brevo = require("@getbrevo/brevo");

const sendConfirmationEmail = async (recipientEmail, reviewerEmail, status) => {
  try {
    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      Brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );

    const currentYear = new Date().getFullYear();
    const statusText = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Review Status Update</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 20px; }
        .status { font-weight: bold; color: ${status === 'accepted' ? '#27ae60' : '#e74c3c'}; }
        .button { background-color: #9e0f8b; color: #fff; padding: 10px 15px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 15px 0; }
        .footer { font-size: 0.8em; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Review Request Update</h2>
    </div>
    
    <p>Dear Editor,</p>
    
    <p>Your review request has been <span class="status">${statusText}</span> by ${reviewerEmail}.</p>
    
    <p>Please login to your dashboard to view details and monitor the review process:</p>
    
    <a href="https://asfirj.org/portal/login/" class="button">Access Your Dashboard</a>
    
    <div class="footer">
        <p>ASFI Research Journal &copy; ${currentYear}</p>
        <p style="font-size: 0.8em;">
            <a href="https://asfirj.org/unsubscribe?email=${encodeURIComponent(recipientEmail)}">Unsubscribe</a> | 
            <a href="https://asfirj.org/contact">Contact Us</a>
        </p>
    </div>
</body>
</html>
    `;

    const emailData = {
      sender: { 
        email: process.env.BREVO_EMAIL, 
        name: "ASFI Research Journal" 
      },
      to: [{ email: recipientEmail }],
      subject: `Review Request ${statusText} - ASFI Research Journal`,
      htmlContent: htmlContent,
      headers: {
        'List-Unsubscribe': `<https://asfirj.org/unsubscribe?email=${encodeURIComponent(recipientEmail)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    };

    await apiInstance.sendTransacEmail(emailData);
    return { status: "success", message: "Confirmation email sent successfully" };

  } catch (error) {
    console.error("Error sending confirmation email:", error);
    return { status: "error", message: error.message };
  }
};

module.exports = sendConfirmationEmail;