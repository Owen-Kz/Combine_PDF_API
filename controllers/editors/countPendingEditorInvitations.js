const dbPromise = require("../../routes/dbPromise.config");

const countPendingEditorInvitations = async (req, res) => {
    try {
        const { revision_id } = req.query;
        const [result] = await dbPromise.query(
            "SELECT COUNT(*) as count FROM editor_invitations WHERE revision_id = ? AND status = 'pending'",
            [revision_id]
        );
        res.json({ count: result[0].count });
    } catch (error) {
        res.status(500).json({ count: 0 });
    }
};

module.exports = countPendingEditorInvitations;