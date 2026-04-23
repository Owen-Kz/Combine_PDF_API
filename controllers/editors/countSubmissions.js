
const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");

const countSubmissions = async (req, res) => {
    try {
        const userId = req.user.id;
    
        if (!userId) {
            return res.json({ error: "Invalid Parameters" });
        }

        // Check if the user is an admin
        const isAdmin = await isAdminAccount(userId);

        let query;
        if (isAdmin) {
            // If admin, count submissions with status 'submitted' or 'correction_submitted'
            query = `SELECT COUNT(*) AS count FROM submissions WHERE status IN ('submitted', 'correction_submitted')`;
        } else {
            // If not admin, count submitted for edit with 'edit_invitation_accepted' status
            query = `SELECT COUNT(*) AS count FROM submitted_for_edit WHERE editor_email = ? AND status = 'edit_invitation_accepted'`;
        }

        db.query(query, [userId], (error, results) => {
            if (error) {
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

module.exports = countSubmissions;
