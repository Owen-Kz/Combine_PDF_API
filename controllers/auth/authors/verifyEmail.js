// controllers/auth/authors/verifyEmail.js
const db = require("../../../routes/db.config");

/**
 * Verifies author email using verification token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyEmail = async (req, res) => {
  let connection;
  
  try {
    const { token, email } = req.query;

    console.log("=== EMAIL VERIFICATION REQUEST ===");
    console.log("Token:", token);
    console.log("Email:", email);

    if (!token || !email) {
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid verification link" 
      });
    }

    connection = await db.promise();

    // Find user with this token and email
    const [users] = await connection.query(
      `SELECT id, email, account_status, token_expiry 
       FROM authors_account 
       WHERE email = ? AND verification_token = ?`,
      [email, token]
    );

    if (users.length === 0) {
      console.error("No user found with this verification token");
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid verification link" 
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

    // Check if token has expired
    const now = new Date();
    const tokenExpiry = new Date(user.token_expiry);

    if (tokenExpiry < now) {
      return res.status(400).json({ 
        status: "error", 
        message: "Verification link has expired. Please request a new one.",
        expired: true
      });
    }

    // Update user status to verified and clear token
    await connection.query(
      `UPDATE authors_account 
       SET account_status = 'verified', verification_token = NULL, token_expiry = NULL, email_verified_at = NOW() 
       WHERE id = ?`,
      [user.id]
    );

    console.log("Email verified successfully for user:", email);

    return res.json({ 
      status: "success", 
      message: "Email verified successfully! You can now log in." 
    });

  } catch (error) {
    console.error("=== ERROR IN EMAIL VERIFICATION ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    return res.status(500).json({ 
      status: "error", 
      message: process.env.NODE_ENV === 'development' ? error.message : "An error occurred during verification" 
    });
  }
};

module.exports = verifyEmail;