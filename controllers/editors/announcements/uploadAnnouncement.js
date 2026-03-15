const  dbPromise  = require("../../../routes/journal.db");
const isAdminAccount = require("../isAdminAccount");

const uploadAnnouncement = async (req, res) => {
    try {
        const { title, content, priority} = req.body;

        if (!title || !content || !priority) {
            return res.status(400).json({
                status: "error",
                message: "All fields are required"
            });
        }

        // Verify admin code (you might want to implement proper verification)
         if (!req.user || !await isAdminAccount(req.user.id)) {
            return res.status(403).json({
                status: "error",
                message: "Unauthorized Access"
            });
        }

        // Generate slug from title
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        // Insert announcement into database
        const [result] = await dbPromise.query(
            "INSERT INTO `announcements` (`title`, `slug`, `data`, `timestamp`, `admin_email`, `priority`) VALUES (?, ?, ?, NOW(), ?, ?)",
            [title, slug, content, req.user.email, priority]
        );

        if (result.affectedRows === 0) {
            throw new Error("Failed to insert announcement");
        }

        return res.json({
            status: "success",
            message: "Announcement uploaded successfully",
            id: result.insertId
        });

    } catch (error) {
        console.error("Error uploading announcement:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
            error: error.message
        });
    }
};

module.exports = uploadAnnouncement;