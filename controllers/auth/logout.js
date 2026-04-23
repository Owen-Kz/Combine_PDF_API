// backend/controllers/auth/logout.js
const db = require("../../routes/db.config");

const logout = async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(400).json({ success: false, message: "No token provided" });
    }

    try {
        // Delete session from database
        await db.promise().query(
            "DELETE FROM editors_session WHERE session_token = ?",
            [token]
        );
          await db.promise().query(
            "DELETE FROM authors_session WHERE session_token = ?",
            [token]
        );

        // Clear cookies if they exist
        res.clearCookie('asfirj_userRegistered');
        res.clearCookie('editor');

        return res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = logout;