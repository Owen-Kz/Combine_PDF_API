// controllers/auth/authors/resetPassword.js
const db = require("../../../routes/db.config");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

/**
 * Resets author's password using valid token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const resetPassword = async (req, res) => {
  let connection;
  
  try {
    const { token, email, password } = req.body;

    console.log("=== RESET PASSWORD REQUEST ===");
    console.log("Email:", email);
    console.log("Token:", token ? "Present" : "Missing");

    // Validate required fields
    if (!token || !email || !password) {
      const missingFields = [];
      if (!token) missingFields.push('token');
      if (!email) missingFields.push('email');
      if (!password) missingFields.push('password');
      
      return res.status(400).json({ 
        status: "error", 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid email format" 
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ 
        status: "error", 
        message: "Password must be at least 8 characters long" 
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({ 
        status: "error", 
        message: "Password must contain at least one uppercase letter, one lowercase letter, and one number" 
      });
    }

    connection = await db.promise();
    await connection.beginTransaction();

    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with this token and email
    const [users] = await connection.query(
      `SELECT id, email, firstname, lastname, reset_password_expiry 
       FROM authors_account 
       WHERE email = ? AND reset_password_token = ?`,
      [email, hashedToken]
    );

    if (users.length === 0) {
      await connection.rollback();
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid or expired reset link" 
      });
    }

    const user = users[0];

    // Check if token has expired
    const now = new Date();
    const tokenExpiry = new Date(user.reset_password_expiry);

    if (tokenExpiry < now) {
      await connection.rollback();
      return res.status(400).json({ 
        status: "error", 
        message: "Reset link has expired. Please request a new one.",
        expired: true
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await connection.query(
      `UPDATE authors_account 
       SET password = ?, 
           reset_password_token = NULL, 
           reset_password_expiry = NULL,
           password_updated_at = NOW() 
       WHERE id = ?`,
      [hashedPassword, user.id]
    );

    if(user.is_editor === "yes"){
           await connection.query(
      `UPDATE editors 
       SET password = ?, 
       WHERE email = ?`,
      [hashedPassword, user.email]
    );
    }

    await connection.commit();
    console.log("Password reset successfully for user:", email);

    // Send confirmation email (optional)
    try {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Confirmation - ASFI Research Journal</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(to right, #250242, #550f4f); color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px 20px; background: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Password Reset Successful</h2>
          </div>
          <div class="content">
            <p>Dear ${user.firstname} ${user.lastname},</p>
            
            <p>Your password has been successfully reset.</p>
            
            <p>If you did not perform this action, please contact support immediately.</p>
            
            <p>You can now log in with your new password.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ASFI Research Journal. All rights reserved.</p>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: email,
        subject: "Password Reset Successful - ASFI Research Journal",
        htmlContent: emailHtml,
        fromName: "ASFI Research Journal"
      });
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Don't fail the request if confirmation email fails
    }

    return res.json({
      status: "success",
      message: "Password reset successfully! You can now log in with your new password."
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("=== ERROR IN RESET PASSWORD ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    if (error.code) {
      console.error("Error code:", error.code);
      console.error("Error errno:", error.errno);
      console.error("SQL State:", error.sqlState);
    }

    return res.status(500).json({ 
      status: "error", 
      message: process.env.NODE_ENV === 'development' ? error.message : "An error occurred. Please try again later."
    });
  }
};

module.exports = resetPassword;