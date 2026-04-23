const dbPromise = require("../../../routes/journal.db");

const getAnnouncements = async (req, res) => {
    try {
        console.log("Fetching announcements from database...");
        
        // Get announcements from database
        const [rows] = await dbPromise.query(
            "SELECT `id`, `title`, `slug`, `data`, `timestamp`, `admin_email`, `priority`, `start_date`, `end_date` FROM `announcements` ORDER BY `timestamp` DESC"
        );

        // Transform database rows to match the expected format
        const announcements = rows.map(row => ({
            id: row.id,
            title: row.title,
            content: row.data, // Map 'data' column to 'content'
            priority: row.priority || 'medium',
            author: row.admin_email ? row.admin_email.split('@')[0] : 'Admin', // Extract name from email or use default
            authorEmail: row.admin_email,
            dateCreated: row.timestamp,
            lastUpdated: row.timestamp,
            status: getStatusFromDates(row.start_date, row.end_date), // Determine status based on dates
            targetAudience: 'all', // Default value since not in schema
            views: 0, // Default value since not tracked
            startDate: row.start_date,
            endDate: row.end_date,
            slug: row.slug
        }));

        return res.json({
            status: "success",
            announcements: announcements
        });

    } catch (error) {
        console.error("Error fetching announcements:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
            error: error.message
        });
    }
};

// Helper function to determine status based on dates
const getStatusFromDates = (startDate, endDate) => {
    const now = new Date();
    
    if (!startDate && !endDate) return 'active';
    
    if (startDate && new Date(startDate) > now) return 'draft';
    
    if (endDate && new Date(endDate) < now) return 'archived';
    
    return 'active';
};

module.exports = getAnnouncements;