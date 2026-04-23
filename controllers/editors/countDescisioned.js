// backend/controllers/editors/countDecisioned.js
const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");

const countDecisioned = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!userId) {
            return res.json({ error: "Invalid Parameters" });
        }

        // Check if user is admin
        const isAdmin = await isAdminAccount(userId);

        let query;
        if (isAdmin) {
            // Count submissions with decision statuses (accepted, rejected, published)
            query = `SELECT COUNT(*) AS count FROM submissions WHERE status IN ('accepted', 'rejected', 'published')`;
        } else {
            // For non-admin editors, count decisions they've made
            query = `SELECT COUNT(*) AS count FROM submissions WHERE handled_by = ? AND status IN ('accepted', 'rejected', 'published')`;
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

module.exports = countDecisioned;