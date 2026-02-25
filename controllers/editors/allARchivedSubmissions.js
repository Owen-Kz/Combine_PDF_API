const dbPromise = require("../../routes/dbPromise.config");
const isAdminAccount = require("./isAdminAccount");

const ArchivedSubmissions = async (req, res) => {
    try {
        const id = req.user.id;
        const page = req.query.page ? parseInt(req.query.page) : 1;
        const pageSize = 5;
        const offset = (page - 1) * pageSize;
        const searchQuery = req.query.search || '';

        // Check if user is admin
        const isAdmin = await isAdminAccount(id);
        if (!isAdmin) {
            return res.status(403).json({ 
                success: false,
                error: "Not authorized" 
            });
        }

        // Build main query
        let query = `SELECT * FROM archived_submissions WHERE title != ''`;
        let params = [];
        
        if (searchQuery && searchQuery.length >= 2) {
            query += ` AND (title LIKE ? OR revision_id = ? OR article_id = ? OR status LIKE ?)`;
            params.push(
                `%${searchQuery}%`,
                `${searchQuery}`,
                `${searchQuery}`,
                `%${searchQuery}%`
            );
        }
        
        query += ` ORDER BY process_start_date DESC LIMIT ? OFFSET ?`;
        params.push(pageSize, offset);

        // Execute main query using promise
        const [submissions] = await dbPromise.query(query, params);

        // Build count query
        let countQuery = `SELECT COUNT(*) as total FROM archived_submissions WHERE title != ''`;
        let countParams = [];
        
        if (searchQuery && searchQuery.length >= 2) {
            countQuery += ` AND (title LIKE ? OR revision_id = ? OR article_id = ? OR status LIKE ?)`;
            countParams.push(
                `%${searchQuery}%`,
                `${searchQuery}`,
                `${searchQuery}`,
                `%${searchQuery}%`
            );
        }

        // Execute count query using promise
        const [countResult] = await dbPromise.query(countQuery, countParams);

        res.json({
            success: true,
            submissions: submissions,
            total: countResult[0].total,
            totalPages: Math.ceil(countResult[0].total / pageSize),
            currentPage: page
        });

    } catch (error) {
        console.error('ArchivedSubmissions error:', error);
        res.status(500).json({ 
            success: false,
            error: "Server error occurred" 
        });
    }
};

module.exports = ArchivedSubmissions;