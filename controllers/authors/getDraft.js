// backend/controllers/author/getDraftSubmissions.js
const db = require("../../routes/db.config");
const dbPromise = require("../../routes/dbPromise.config");

const getDraftSubmissions = async (req, res) => {
    try {
        const userEmail = req.user.email; // From auth middleware
        
        if (!userEmail) {
            return res.status(400).json({ 
                status: "error", 
                message: "User email not found" 
            });
        }

        // Get pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        // Build WHERE clause for drafts
        let whereConditions = [
            'corresponding_authors_email = ?',
            '(status = "draft" OR status = "saved" OR status = "drafted" OR status = "revision_saved" OR status = "correction_saved")'
        ];
        let queryParams = [userEmail];

        // Add search condition
        if (search) {
            whereConditions.push('(title LIKE ? OR revision_id LIKE ?)');
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm);
        }

        const whereClause = whereConditions.join(' AND ');

        // Get total count for pagination
        const [countResult] = await db.promise().query(
            `SELECT COUNT(*) as total FROM submissions WHERE ${whereClause}`,
            queryParams
        );
        const totalCount = countResult[0].total;

        // Get paginated draft submissions
        const [submissions] = await db.promise().query(
            `SELECT 
                revision_id as id,
                article_id,
                title,
                article_type as type,
                status,
                date_submitted as date,
                last_updated,
                previous_manuscript_id
             FROM submissions 
             WHERE ${whereClause} 
             ORDER BY last_updated DESC, id DESC
             LIMIT ? OFFSET ?`,
            [...queryParams, limit, offset]
        );

        // Get additional details for each draft
        const draftsWithDetails = await Promise.all(
            submissions.map(async (submission) => {
                const [keywords] = await db.promise().query(
                    `SELECT keyword FROM submission_keywords 
                     WHERE article_id = ? 
                     ORDER BY id ASC`,
                    [submission.id]
                );
                
                const [authors] = await dbPromise.query(
                    `SELECT authors_fullname as name, authors_email as email 
                     FROM submission_authors 
                     WHERE submission_id = ?`,
                    [submission.id]
                );
                
                // Determine which step the user is on based on filled fields
                let currentStep = 1;
                const submissionData = await dbPromise.query(
                    `SELECT article_type, discipline, title, abstract, manuscript_file, cover_letter_file
                     FROM submissions WHERE revision_id = ?`,
                    [submission.id]
                );
                
                if (submissionData[0]?.manuscript_file && submissionData[0]?.cover_letter_file) currentStep = 3;
                if (submissionData[0]?.title) currentStep = 4;
                if (submissionData[0]?.abstract) currentStep = 5;
                if (keywords && keywords.length > 0) currentStep = 6;
                if (authors && authors.length > 0) currentStep = 7;
                
                return {
                    ...submission,
                    keywords: keywords.map(k => k.keyword),
                    authors: authors,
                    currentStep,
                    progress: Math.round((currentStep / 9) * 100),
                    canContinue: true
                };
            })
        );

        return res.json({
            status: "success",
            drafts: draftsWithDetails,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount,
                limit: limit
            }
        });

    } catch (error) {
        console.error("Error fetching draft submissions:", error);
        return res.status(500).json({ 
            status: "error", 
            message: "Internal server error" 
        });
    }
};

module.exports = getDraftSubmissions;