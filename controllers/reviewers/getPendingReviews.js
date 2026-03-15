const db = require("../../routes/db.config");


const getPendingReviews = async (req, res) => {
    try {
        const userEmail = req.user.email; // From auth middleware
        
        if (!userEmail) {
            return res.status(400).json({ 
                status: "error", 
                message: "User email not found" 
            });
        }

        // Get pagination and filter parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const priority = req.query.priority || 'all';

        // Get reviews where reviewer is the current user and status is in-progress/draft/saved
        let reviewQuery = `
            SELECT r.*, 
                   s.title, 
                   s.article_type,
                   s.abstract,
                   s.manuscript_file,
                   s.document_file,
                   s.tracked_manuscript_file,
                   s.cover_letter_file,
                   s.tables,
                   s.figures,
                   s.graphic_abstract,
                   s.supplementary_material,
                   s.date_submitted,
                   s.revision_id,
                   s.revisions_count,
                   s.corrections_count,
                   s.status as manuscript_status,
                   s.is_women_in_contemporary_science
            FROM reviews r
            LEFT JOIN submissions s ON r.article_id = s.revision_id
            WHERE r.reviewer_email = ? 
            AND (r.review_status = 'saved' OR r.review_status = 'draft' OR r.review_status = 'in_progress')
        `;

        let countQuery = `
            SELECT COUNT(*) as total
            FROM reviews r
            WHERE r.reviewer_email = ? 
            AND (r.review_status = 'saved' OR r.review_status = 'draft' OR r.review_status = 'in_progress')
        `;

        let queryParams = [userEmail];
        let countParams = [userEmail];

        // Add search condition
        if (search) {
            reviewQuery += ` AND (s.title LIKE ? OR s.revision_id LIKE ?)`;
            countQuery += ` AND (s.title LIKE ? OR s.revision_id LIKE ?)`;
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm);
        }

        // Get total count for pagination
        const [countResult] = await db.promise().query(countQuery, countParams);
        const totalItems = countResult[0].total;

        // Add pagination
        reviewQuery += ` ORDER BY r.date_created DESC LIMIT ? OFFSET ?`;
        queryParams.push(limit, offset);

        // Execute main query
        const [reviews] = await db.promise().query(reviewQuery, queryParams);

        // For each review, get the authors from submission_authors
        const reviewsWithDetails = await Promise.all(
            reviews.map(async (review) => {
                const [authors] = await db.promise().query(
                    `SELECT authors_fullname, authors_email, orcid_id, asfi_membership_id, 
                            affiliations, affiliation_country, affiliation_city
                     FROM submission_authors 
                     WHERE submission_id = ?`,
                    [review.article_id]
                );

                // Calculate days left (assuming 30 days from submission date)
                const submittedDate = new Date(review.date_created);
                const dueDate = new Date(submittedDate);
                dueDate.setDate(dueDate.getDate() + 30);
                const today = new Date();
                const daysLeft = Math.max(0, Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)));

                // Determine priority based on days left
                let priority = 'normal';
                if (daysLeft <= 3) priority = 'urgent';
                else if (daysLeft <= 7) priority = 'high';
                else if (daysLeft <= 14) priority = 'normal';
                else priority = 'low';

                // Compile files object
                const files = {};
                if (review.manuscript_file) files.manuscript = review.manuscript_file;
                if (review.document_file) files.document = review.document_file;
                if (review.tracked_manuscript_file) files.tracked_manuscript = review.tracked_manuscript_file;
                if (review.cover_letter_file) files.cover_letter = review.cover_letter_file;
                if (review.tables) files.tables = review.tables;
                if (review.figures) files.figures = review.figures;
                if (review.graphic_abstract) files.graphic_abstract = review.graphic_abstract;
                if (review.supplementary_material) files.supplementary = review.supplementary_material;

                return {
                    id: review.id,
                    reviewId: review.review_id,
                    manuscriptId: review.article_id,
                    title: review.title || 'Untitled',
                    type: review.article_type || 'Research Article',
                    invitedDate: review.date_created ? new Date(review.date_created).toISOString().split('T')[0] : null,
                    dueDate: dueDate.toISOString().split('T')[0],
                    daysLeft,
                    priority,
                    recommendation: review.overall_recommendation,
                    authors: authors.map(a => a.authors_fullname),
                    authorDetails: authors,
                    abstract: review.abstract,
                    status: review.review_status,
                    files,
                    manuscriptStatus: review.manuscript_status,
                    isWomenInScience: review.is_women_in_contemporary_science === 1
                };
            })
        );

        // Calculate stats
        const stats = {
            total: totalItems,
            urgent: reviewsWithDetails.filter(r => r.priority === 'urgent').length,
            high: reviewsWithDetails.filter(r => r.priority === 'high').length,
            dueThisWeek: reviewsWithDetails.filter(r => r.daysLeft <= 7).length
        };

        return res.json({
            success: true,
            reviews: reviewsWithDetails,
            stats,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit),
                totalItems,
                limit
            }
        });

    } catch (error) {
        console.error("Error fetching pending reviews:", error);
        return res.status(500).json({ 
            success: false,
            message: "Internal server error" 
        });
    }
};

module.exports = getPendingReviews;