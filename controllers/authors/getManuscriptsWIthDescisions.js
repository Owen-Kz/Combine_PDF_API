// backend/controllers/author/getManuscriptsWithDecisions.js
const db = require("../../routes/db.config");

const getManuscriptsWithDecisions = async (req, res) => {
    try {
        const userEmail = req.user.email; // From auth middleware
        
        if (!userEmail) {
            return res.status(400).json({ 
                status: "error", 
                message: "User email not found" 
            });
        }

        // Get pagination and filter parameters from query
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const decision = req.query.decision || 'all'; // 'accept', 'reject', 'revision', 'correction', 'all'
        const sortBy = req.query.sortBy || 'id';
        const sortOrder = req.query.sortOrder || 'DESC';

        // Statuses that indicate a decision has been made
        const decisionStatuses = [
            'returned_for_revision',
            'returned_for_correction', 
            'accepted',
            'rejected'
        ];

        // Build WHERE clause
        let whereConditions = [
            'corresponding_authors_email = ?',
            'status IN (?)'
        ];
        let queryParams = [userEmail, decisionStatuses];

        // Add search condition
        if (search) {
            whereConditions.push('(title LIKE ? OR revision_id LIKE ? OR abstract LIKE ?)');
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        // Add decision filter
        if (decision !== 'all') {
            if (decision === 'revision') {
                whereConditions.push('(status = ? OR status = ?)');
                queryParams.push('returned_for_revision', 'returned_for_correction');
            } else {
                whereConditions.push('status = ?');
                queryParams.push(decision === 'accept' ? 'accepted' : 
                                decision === 'reject' ? 'rejected' : decision);
            }
        }

        const whereClause = whereConditions.join(' AND ');

        // Get total count for pagination
        const [countResult] = await db.promise().query(
            `SELECT COUNT(*) as total FROM submissions WHERE ${whereClause}`,
            queryParams
        );
        const totalCount = countResult[0].total;

        // Get paginated submissions
        const [submissions] = await db.promise().query(
            `SELECT 
                revision_id as id,
                revision_id,
                title,
                article_type as type,
                status,
                date_submitted as submittedDate,
                last_updated as lastUpdated,
                abstract,
                process_start_date
             FROM submissions 
             WHERE ${whereClause} 
             ORDER BY ${sortBy} ${sortOrder}
             LIMIT ? OFFSET ?`,
            [...queryParams, limit, offset]
        );

        // Get stats for cards
        const [stats] = await db.promise().query(
            `SELECT 
                COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
                COUNT(CASE WHEN status = 'returned_for_revision' OR status = 'returned_for_correction' THEN 1 END) as revisions,
                COUNT(*) as total
             FROM submissions 
             WHERE corresponding_authors_email = ? 
             AND status IN (?)`,
            [userEmail, decisionStatuses]
        );

        return res.json({
            status: "success",
            manuscripts: submissions,
            stats: stats[0] || {
                accepted: 0,
                rejected: 0,
                revisions: 0,
                total: 0
            },
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount,
                limit: limit
            }
        });

    } catch (error) {
        console.error("Error fetching manuscripts with decisions:", error);
        return res.status(500).json({ 
            status: "error", 
            message: "Internal server error" 
        });
    }
};

module.exports = getManuscriptsWithDecisions;