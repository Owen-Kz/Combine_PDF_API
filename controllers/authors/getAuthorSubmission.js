// backend/controllers/author/getAuthorSubmissions.js
const db = require("../../routes/db.config");
const dbPromise = require("../../routes/dbPromise.config");

const getAuthorSubmissions = async (req, res) => {
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
        const status = req.query.status || 'all';
        const sortBy = req.query.sortBy || 'id';
        const sortOrder = req.query.sortOrder || 'DESC';
        const includeDrafts = req.query.includeDrafts === 'true';

        // Build WHERE clause
        let whereConditions = [
            'corresponding_authors_email = ?'
        ];
        let queryParams = [userEmail];

        // Don't filter out drafts unless specifically requested not to include them
        if (!includeDrafts) {
            // For main submissions list, we might want to show drafts
            // This condition is optional - you can remove it to always show drafts
            // whereConditions.push('(title != "" AND title != "Draft Submission")');
        }

        // Add search condition
        if (search) {
            whereConditions.push('(title LIKE ? OR revision_id LIKE ? OR abstract LIKE ?)');
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        // Add status filter
        if (status !== 'all') {
            if (status === 'draft') {
                // Handle draft statuses
                whereConditions.push('(status = "draft" OR status = "saved" OR status = "drafted" OR status = "revision_saved" OR status = "correction_saved")');
            } else {
                whereConditions.push('status = ?');
                queryParams.push(status);
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
            `SELECT * FROM submissions 
             WHERE ${whereClause} 
             ORDER BY ${sortBy} ${sortOrder}
             LIMIT ? OFFSET ?`,
            [...queryParams, limit, offset]
        );

        // Get keywords for all submissions
        const submissionsWithKeywords = await Promise.all(
            submissions.map(async (submission) => {
                const [keywords] = await db.promise().query(
                    `SELECT keyword FROM submission_keywords 
                     WHERE article_id = ? 
                     ORDER BY id ASC`,
                    [submission.revision_id || submission.id]
                );
                
                // Get authors for this submission
                const [authors] = await dbPromise.query(
                    `SELECT authors_fullname as name, authors_email as email 
                     FROM submission_authors 
                     WHERE submission_id = ?`,
                    [submission.revision_id || submission.id]
                );
                
                return {
                    ...submission,
                    keywords: keywords.map(k => k.keyword),
                    authors_list: authors
                };
            })
        );

        // Get count of submissions in different statuses for stats
        const [stats] = await db.promise().query(
            `SELECT 
                COUNT(CASE WHEN status = 'submitted' OR status = 'under_review' OR status = 'review_invitation_accepted' OR status = 'review_invitation_rejected' OR status = 'review_submitted' THEN 1 END) as inReview,
                COUNT(CASE WHEN status = 'returned_for_correction' OR status = 'returned_for_revision' THEN 1 END) as returned,
                COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
                COUNT(CASE WHEN status = 'draft' OR status = 'saved' OR status = 'drafted' OR status = 'revision_saved' OR status = 'correction_saved' THEN 1 END) as draft,
                COUNT(*) as total
             FROM submissions 
             WHERE corresponding_authors_email = ?`,
            [userEmail]
        );

        return res.json({
            status: "success",
            submissions: submissionsWithKeywords,
            stats: stats[0] || {
                inReview: 0,
                returned: 0,
                accepted: 0,
                rejected: 0,
                draft: 0,
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
        console.error("Error fetching author submissions:", error);
        return res.status(500).json({ 
            status: "error", 
            message: "Internal server error" 
        });
    }
};

module.exports = getAuthorSubmissions;