// controllers/auth/authors/forgotPassword.js
const db = require("../../../routes/db.config");
const crypto = require("crypto");
const { sendEmail } = require("../../utils/sendEmail");

/**
 * Sends password reset link to author's email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const forgotPassword = async (req, res) => {
  let connection;
  
  try {
    const { email } = req.body;

    console.log("=== FORGOT PASSWORD REQUEST ===");
    console.log("Email:", email);

    // Validate email
    if (!email) {
      return res.status(400).json({ 
        status: "error", 
        message: "Email is required" 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid email format" 
      });
    }

    connection = await db.promise();

    // Check if user exists
    const [users] = await connection.query(
      "SELECT id, firstname, lastname, email, account_status FROM authors_account WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      // For security, don't reveal that user doesn't exist
      console.log("Password reset attempted for non-existent email:", email);
      return res.json({ 
        status: "success", 
        message: "If an account exists with this email, you will receive password reset instructions." 
      });
    }

    const user = users[0];

    // Check if account is verified
    if (user.account_status !== 'verified') {
      return res.status(400).json({ 
        status: "error", 
        message: "Please verify your email first before resetting your password." 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 1); // Token valid for 1 hour

    // Hash the token before storing (optional but recommended)
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Store reset token in database
    await connection.query(
      `UPDATE authors_account 
       SET reset_password_token = ?, reset_password_expiry = ? 
       WHERE id = ?`,
      [hashedToken, tokenExpiry, user.id]
    );

    console.log("Reset token generated for user:", user.email);

    // Send reset email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - ASFI Research Journal</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(to right, #250242, #550f4f); color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 30px; background: #8a1e78; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .button:hover { background: #6a175e; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; border-top: 1px solid #eee; }
          .warning { background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 10px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Password Reset Request</h2>
        </div>
        <div class="content">
          <p>Dear ${user.firstname} ${user.lastname},</p>
          
          <p>We received a request to reset your password for your ASFI Research Journal account.</p>
          
          <div style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Your Password</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetLink}</p>
          
          <div class="warning">
            <p><strong>⚠️ This link will expire in 1 hour.</strong></p>
          </div>
          
          <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ASFI Research Journal. All rights reserved.</p>
          <p style="font-size: 0.8em;">This is an automated message, please do not reply.</p>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: email,
      subject: "Reset Your Password - ASFI Research Journal",
      htmlContent: emailHtml,
      fromName: "ASFI Research Journal"
    });

    console.log("Password reset email sent to:", email);

    return res.json({
      status: "success",
      message: "If an account exists with this email, you will receive password reset instructions."
    });

  } catch (error) {
    console.error("=== ERROR IN FORGOT PASSWORD ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    return res.status(500).json({ 
      status: "error", 
      message: process.env.NODE_ENV === 'development' ? error.message : "An error occurred. Please try again later."
    });
  }
};

module.exports = forgotPassword;