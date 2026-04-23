// controllers/auth/authors/resendVerification.js
const db = require("../../../routes/db.config");
const crypto = require("crypto");
const { sendEmail } = require("../../utils/sendEmail");
/**
 * Resends verification email to author
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const resendVerification = async (req, res) => {
  let connection;
  
  try {
    const { email } = req.body;

    console.log("=== RESEND VERIFICATION REQUEST ===");
    console.log("Email:", email);

    if (!email) {
      return res.status(400).json({ 
        status: "error", 
        message: "Email is required" 
      });
    }

    connection = await db.promise();

    // Find user with this email
    const [users] = await connection.query(
      `SELECT id, firstname, lastname, account_status 
       FROM authors_account 
       WHERE email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        status: "error", 
        message: "No account found with this email." 
      });
    }

    const user = users[0];

    // Check if already verified
    if (user.account_status === 'verified') {
      return res.status(400).json({ 
        status: "error", 
        message: "Email already verified. Please log in." 
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24); // Token valid for 24 hours

    // Update user with new token
    await connection.query(
      `UPDATE authors_account 
       SET verification_token = ?, token_expiry = ? 
       WHERE id = ?`,
      [verificationToken, tokenExpiry, user.id]
    );

    // Send verification email
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - ASFI Research Journal</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(to right, #250242, #550f4f); color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 30px; background: #8a1e78; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .button:hover { background: #6a175e; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Email Verification - ASFI Research Journal</h2>
        </div>
        <div class="content">
          <p>Dear ${user.firstname} ${user.lastname},</p>
          
          <p>Here is your new verification link. Please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center;">
            <a href="${verificationLink}" class="button">Verify Email Address</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationLink}</p>
          
          <p>This link will expire in 24 hours.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ASFI Research Journal. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: email,
      subject: "Verify Your Email - ASFI Research Journal",
      htmlContent: emailHtml,
      fromName: "ASFI Research Journal"
    });

    console.log("Verification email resent successfully to:", email);

    return res.json({
      status: "success",
      message: "Verification email sent successfully. Please check your inbox."
    });

  } catch (error) {
    console.error("=== ERROR IN RESEND VERIFICATION ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    return res.status(500).json({ 
      status: "error", 
      message: process.env.NODE_ENV === 'development' ? error.message : "An error occurred while sending verification email" 
    });
  }
};

module.exports = resendVerification;