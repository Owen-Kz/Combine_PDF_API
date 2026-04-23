const dbPromise = require("../../../routes/journal.db");
const isAdminAccount = require("../isAdminAccount");
const deleteAnnouncement = async (req, res) => {
    try {
        const { id} = req.body;

        if (!id) {
            return res.status(400).json({
                status: "error",
                message: "All fields are required"
            });
        }

        if (!req.user || !await isAdminAccount(req.user.id)) {
            return res.status(403).json({
                status: "error",
                message: "Unauthorized Access"
            });
        }
        // Check if announcement exists
        const [existing] = await dbPromise.query(
            "SELECT id FROM `announcements` WHERE id = ?",
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Announcement not found"
            });
        }

        // Delete announcement from database
        const [result] = await dbPromise.query(
            "DELETE FROM `announcements` WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            throw new Error("Failed to delete announcement");
        }

        return res.json({
            status: "success",
            success: "Announcement deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting announcement:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
            error: error.message
        });
    }
};

module.exports = deleteAnnouncement;