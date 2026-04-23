const db = require("../../routes/db.config");



const countReviewed = async (req, res) => {
    try {
        const articleID = req.user.id;
        
        if (!articleID) {
            return res.json({ error: "couldNotCount", count: 0 });
        }

        const query = `
SELECT COUNT(*) AS count FROM submissions WHERE status = 'review_submitted'
        `;

        db.query(query, (error, results) => {
            if (error) {
                return res.status(500).json({ error: "Database error", message: error.message });
            }

            const count = results[0]?.countInvitations || 0;
            return res.json({ success: "counted", count });
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Server error", message: error.message });
    }
};

module.exports = countReviewed;
