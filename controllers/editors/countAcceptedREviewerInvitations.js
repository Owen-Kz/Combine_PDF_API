const db = require("../../routes/db.config");



const countReviewInvitations = async (req, res) => {
    try {
        const articleID = req.query.a_id;
        
        if (!articleID) {
            return res.json({ error: "couldNotCount", count: 0 });
        }

        const query = `
            SELECT COUNT(*) AS countInvitations 
            FROM invitations 
            WHERE invitation_status = 'review_invitation_accepted' 
            AND invitation_link = ?
        `;

        db.query(query, [articleID], (error, results) => {
            if (error) {
                console.log(error)
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

module.exports = countReviewInvitations;
