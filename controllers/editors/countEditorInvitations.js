const db = require("../../routes/db.config");



const countEditorInvitations = (req, res) => {
    const articleID = req.query.a_id;

    if (!articleID) {
        return res.json({ error: "Invalid Parameters" });
    }

    const query = `SELECT COUNT(*) AS countInvitations FROM invitations WHERE invitation_status = 'invite_sent' AND invited_for = 'To Edit' AND invitation_link = ?`;

    db.query(query, [articleID], (error, results) => {
        if (error) {
            console.log(error)
            return res.status(500).json({ error: "Database error", message: error.message });
        }

        const count = results[0]?.countInvitations || 0;
        return res.json({ success: "counted", count });
    });
};

module.exports = countEditorInvitations;
