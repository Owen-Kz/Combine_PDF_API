// controllers/auth/authors/validateResetToken.js
const db = require("../../../routes/db.config");
const crypto = require("crypto");

/**
 * Validates password reset token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const validateResetToken = async (req, res) => {
  try {
    const { token, email } = req.query;

    console.log("=== VALIDATE RESET TOKEN REQUEST ===");
    console.log("Token:", token);
    console.log("Email:", email);

    if (!token || !email) {
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid reset link" 
      });
    }

    const connection = await db.promise();

    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with this token and email
    const [users] = await connection.query(
      `SELECT id, email, reset_password_expiry 
       FROM authors_account 
       WHERE email = ? AND reset_password_token = ?`,
      [email, hashedToken]
    );

    if (users.length === 0) {
      console.error("No user found with this reset token");
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
      console.error("Reset token has expired");
      return res.status(400).json({ 
        status: "error", 
        message: "Reset link has expired. Please request a new one.",
        expired: true
      });
    }

    console.log("Reset token is valid for user:", email);

    return res.json({
      status: "success",
      message: "Reset token is valid"
    });

  } catch (error) {
    console.error("=== ERROR IN VALIDATE RESET TOKEN ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    return res.status(500).json({ 
      status: "error", 
      message: process.env.NODE_ENV === 'development' ? error.message : "An error occurred. Please try again later."
    });
  }
};

module.exports = validateResetToken;