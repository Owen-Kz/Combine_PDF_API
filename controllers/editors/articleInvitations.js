const db = require("../../routes/db.config");


const getInvitations = async (req, res) => {
    try {
        const { article_id } = req.body;
   

        if (!article_id) {
            return res.status(400).json({ error: "Invalid Parameters" });
        }

        const query = "SELECT * FROM `submitted_for_review` WHERE `article_id` = ? ORDER BY `id` DESC";

        db.query(query, [article_id], (error, results) => {
            if (error) {
                return res.status(500).json({ error: error.message });
            }

            if (results.length > 0) {
                return res.json({ success: "Review Available", reviews: results });
            } else {
                return res.json({ error: "No review invitations have been sent" });
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};

module.exports = getInvitations;
