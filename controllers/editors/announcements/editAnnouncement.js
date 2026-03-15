const dbPromise = require("../../../routes/journal.db");
const isAdminAccount = require("../isAdminAccount");
const editAnnouncement = async (req, res) => {
    try {
        const { id, title, content, priority} = req.body;

        if (!id || !title || !content || !priority) {
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

        // Generate slug from title
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        // Update announcement in database
        const [result] = await dbPromise.query(
            "UPDATE `announcements` SET `title` = ?, `slug` = ?, `data` = ?, `priority` = ?, `timestamp` = NOW() WHERE `id` = ?",
            [title, slug, content, priority, id]
        );

        if (result.affectedRows === 0) {
            throw new Error("Failed to update announcement");
        }

        return res.json({
            status: "success",
            message: "Announcement edited successfully"
        });

    } catch (error) {
        console.error("Error editing announcement:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
            error: error.message
        });
    }
};

module.exports = editAnnouncement;