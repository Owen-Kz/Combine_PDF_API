// backend/controllers/editors/countArchived.js
const db = require("../../routes/db.config");

const countArchived = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!userId) {
            return res.json({ error: "Invalid Parameters" });
        }

        // Check if user is admin (you can use your isAdminAccount function)
        const isAdmin = await isAdminAccount(userId);

        let query;
        if (isAdmin) {
            // Count archived submissions from archived_submissions table
            query = `SELECT COUNT(*) AS count FROM archived_submissions`;
        } else {
            // For non-admin editors, count only their archived submissions
            query = `SELECT COUNT(*) AS count FROM archived_submissions WHERE archived_by = ?`;
        }

        db.query(query, [userId], (error, results) => {
            if (error) {
                console.log(error)
                return res.status(500).json({ error: "Database error", message: error.message });
            }

            const count = results[0]?.count || 0;
            return res.json({ success: "CountSuccess", count });
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Server error", message: error.message });
    }
};

module.exports = countArchived;