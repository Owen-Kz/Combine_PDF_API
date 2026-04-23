// backend/controllers/reviewer/getCompletedReviews.js
const db = require("../../routes/db.config");

const getCompletedReviews = async (req, res) => {
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
        const recommendation = req.query.recommendation || 'all';

        // Get reviews where reviewer is the current user and status is completed/submitted
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
                   s.is_women_in_contemporary_science,
                   DATE_ADD(r.date_created, INTERVAL 30 DAY) as due_date
            FROM reviews r
            LEFT JOIN submissions s ON r.article_id = s.revision_id
            WHERE r.reviewer_email = ? 
            AND (r.review_status = 'review_submitted' OR r.review_status = 'submitted' OR r.review_status = 'completed')
        `;

        let countQuery = `
            SELECT COUNT(*) as total
            FROM reviews r
            WHERE r.reviewer_email = ? 
            AND (r.review_status = 'review_submitted' OR r.review_status = 'submitted' OR r.review_status = 'completed')
        `;

        let queryParams = [userEmail];
        let countParams = [userEmail];

        // Add search condition
        if (search) {
            reviewQuery += ` AND (s.title LIKE ? OR s.revision_id LIKE ? OR r.overall_recommendation LIKE ?)`;
            countQuery += ` AND (s.title LIKE ? OR s.revision_id LIKE ? OR r.overall_recommendation LIKE ?)`;
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm);
        }

        // Add recommendation filter
        if (recommendation !== 'all') {
            reviewQuery += ` AND r.overall_recommendation = ?`;
            countQuery += ` AND r.overall_recommendation = ?`;
            queryParams.push(recommendation);
            countParams.push(recommendation);
        }

        // Get total count for pagination
        const [countResult] = await db.promise().query(countQuery, countParams);
        const totalItems = countResult[0].total;

        // Add pagination
        reviewQuery += ` ORDER BY r.date_completed DESC, r.date_created DESC LIMIT ? OFFSET ?`;
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

                // Calculate total score (sum of all score fields)
                const scoreFields = [
                    'accurately_reflect_manuscript_subject_score',
                    'clearly_summarize_content_score',
                    'presents_what_is_known_score',
                    'gives_accurate_summary_score',
                    'purpose_clear_score',
                    'method_section_clear_score',
                    'study_materials_clearly_described_score',
                    'research_method_valid_score',
                    'ethical_standards_score',
                    'study_find_clearly_described_score',
                    'result_presented_logical_score',
                    'graphics_complement_result_score',
                    'table_follow_specified_standards_score',
                    'tables_add_value_or_distract_score',
                    'issues_with_title_score',
                    'manuscript_present_summary_of_key_findings_score',
                    'manuscript_highlight_strength_of_study_score',
                    'manuscript_compare_findings_score',
                    'manuscript_discuss_meaning_score',
                    'manuscript_describes_overall_story_score',
                    'conclusions_reflect_achievement_score',
                    'manuscript_describe_gaps_score',
                    'referencing_accurate_score',
                    'novelty_score',
                    'quality_score',
                    'scientific_accuracy_score',
                    'overall_merit_score',
                    'english_level_score'
                ];

                let totalScore = 0;
                scoreFields.forEach(field => {
                    if (review[field] && !isNaN(parseInt(review[field]))) {
                        totalScore += parseInt(review[field]);
                    }
                });

                // Determine if review was submitted on time
                const submittedDate = new Date(review.date_completed || review.date_created);
                const dueDate = new Date(review.due_date);
                const wasOnTime = submittedDate <= dueDate;

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
                    submittedDate: review.date_completed ? new Date(review.date_completed).toISOString().split('T')[0] : 
                                 review.date_created ? new Date(review.date_created).toISOString().split('T')[0] : null,
                    reviewDate: review.date_completed ? new Date(review.date_completed).toISOString().split('T')[0] : 
                               new Date(review.date_created).toISOString().split('T')[0],
                    dueDate: review.due_date ? new Date(review.due_date).toISOString().split('T')[0] : null,
                    recommendation: review.overall_recommendation || 'Not specified',
                    scores: {
                        total: totalScore,
                        // You can also include specific score categories if needed
                    },
                    status: review.review_status,
                    authors: authors.map(a => a.authors_fullname),
                    authorDetails: authors,
                    abstract: review.abstract,
                    files,
                    oneParagraphComment: review.one_paragraph_comment,
                    generalComment: review.general_comment,
                    specificComment: review.specific_comment,
                    letterToEditor: review.letter_to_editor,
                    wasOnTime,
                    manuscriptStatus: review.manuscript_status,
                    isWomenInScience: review.is_women_in_contemporary_science === 1
                };
            })
        );

        // Calculate stats
        const totalReviews = reviewsWithDetails.length;
        const onTimeCount = reviewsWithDetails.filter(r => r.wasOnTime).length;
        const lateCount = totalReviews - onTimeCount;
        
        // Calculate average score
        const avgScore = totalReviews > 0 
            ? Math.round(reviewsWithDetails.reduce((acc, r) => acc + (r.scores.total || 0), 0) / totalReviews)
            : 0;

        const stats = {
            total: totalReviews,
            onTime: onTimeCount,
            late: lateCount,
            avgScore
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
        console.error("Error fetching completed reviews:", error);
        return res.status(500).json({ 
            success: false,
            message: "Internal server error" 
        });
    }
};

module.exports = getCompletedReviews;