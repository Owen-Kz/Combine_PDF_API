// backend/controllers/reviewer/getCompletedReviews.js
const db = require("../../routes/db.config");

const SCORE_FIELDS = [
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
        const timing = req.query.timing || 'all';
        const editorStatus = req.query.editorStatus || 'all';

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
                    s.is_kidnapping_for_ransom,
                    s.is_belispoint_academic,
                    (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status IN ('pending', 'invite_sent', 'completed')) as editor_invited,
                    (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status = 'completed') as decision_made,
                    DATE_ADD(r.date_created, INTERVAL 30 DAY) as due_date
            FROM reviews r
            LEFT JOIN submissions s ON r.article_id = s.revision_id
              AND s.id = (SELECT MIN(id) FROM submissions WHERE revision_id = r.article_id)
            WHERE r.reviewer_email = ? 
            AND (r.review_status = 'review_submitted' OR r.review_status = 'submitted' OR r.review_status = 'completed')
        `;

        let countQuery = `
            SELECT COUNT(*) as total
            FROM reviews r
            LEFT JOIN submissions s ON r.article_id = s.revision_id
              AND s.id = (SELECT MIN(id) FROM submissions WHERE revision_id = r.article_id)
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

        // Add timing filter (on-time / late based on 30-day due date)
        if (timing === 'on_time') {
            reviewQuery += ` AND COALESCE(r.date_completed, r.date_created) <= DATE_ADD(r.date_created, INTERVAL 30 DAY)`;
            countQuery += ` AND COALESCE(r.date_completed, r.date_created) <= DATE_ADD(r.date_created, INTERVAL 30 DAY)`;
        } else if (timing === 'late') {
            reviewQuery += ` AND COALESCE(r.date_completed, r.date_created) > DATE_ADD(r.date_created, INTERVAL 30 DAY)`;
            countQuery += ` AND COALESCE(r.date_completed, r.date_created) > DATE_ADD(r.date_created, INTERVAL 30 DAY)`;
        }

        // Add editor status filter
        if (editorStatus === 'notified') {
            reviewQuery += ` AND (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status IN ('pending', 'invite_sent')) > 0 AND (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status = 'completed') = 0`;
            countQuery += ` AND (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status IN ('pending', 'invite_sent')) > 0 AND (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status = 'completed') = 0`;
        } else if (editorStatus === 'decided') {
            reviewQuery += ` AND (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status = 'completed') > 0`;
            countQuery += ` AND (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status = 'completed') > 0`;
        } else if (editorStatus === 'not_notified') {
            reviewQuery += ` AND (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status IN ('pending', 'invite_sent', 'completed')) = 0`;
            countQuery += ` AND (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status IN ('pending', 'invite_sent', 'completed')) = 0`;
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
                let totalScore = 0;
                SCORE_FIELDS.forEach(field => {
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
                    editorInvited: review.editor_invited > 0,
                    decisionMade: review.decision_made > 0,
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
                    isWomenInScience: review.is_women_in_contemporary_science == 1 || review.is_women_in_contemporary_science === 'yes',
                    isBelispointAcademic: review.is_belispoint_academic == 1 || review.is_belispoint_academic === 'yes',
                    isKidnappingForRansom: review.is_kidnapping_for_ransom == 1 || review.is_kidnapping_for_ransom === 'yes'
                };

            
            })
        );

        // Calculate stats across the full filtered set (not just the current page)
        let statsQuery = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN COALESCE(r.date_completed, r.date_created) <= DATE_ADD(r.date_created, INTERVAL 30 DAY) THEN 1 ELSE 0 END) as on_time,
                SUM(CASE WHEN COALESCE(r.date_completed, r.date_created) > DATE_ADD(r.date_created, INTERVAL 30 DAY) THEN 1 ELSE 0 END) as late,
                COALESCE(AVG(
                    COALESCE(r.accurately_reflect_manuscript_subject_score,0) +
                    COALESCE(r.clearly_summarize_content_score,0) +
                    COALESCE(r.presents_what_is_known_score,0) +
                    COALESCE(r.gives_accurate_summary_score,0) +
                    COALESCE(r.purpose_clear_score,0) +
                    COALESCE(r.method_section_clear_score,0) +
                    COALESCE(r.study_materials_clearly_described_score,0) +
                    COALESCE(r.research_method_valid_score,0) +
                    COALESCE(r.ethical_standards_score,0) +
                    COALESCE(r.study_find_clearly_described_score,0) +
                    COALESCE(r.result_presented_logical_score,0) +
                    COALESCE(r.graphics_complement_result_score,0) +
                    COALESCE(r.table_follow_specified_standards_score,0) +
                    COALESCE(r.tables_add_value_or_distract_score,0) +
                    COALESCE(r.issues_with_title_score,0) +
                    COALESCE(r.manuscript_present_summary_of_key_findings_score,0) +
                    COALESCE(r.manuscript_highlight_strength_of_study_score,0) +
                    COALESCE(r.manuscript_compare_findings_score,0) +
                    COALESCE(r.manuscript_discuss_meaning_score,0) +
                    COALESCE(r.manuscript_describes_overall_story_score,0) +
                    COALESCE(r.conclusions_reflect_achievement_score,0) +
                    COALESCE(r.manuscript_describe_gaps_score,0) +
                    COALESCE(r.referencing_accurate_score,0) +
                    COALESCE(r.novelty_score,0) +
                    COALESCE(r.quality_score,0) +
                    COALESCE(r.scientific_accuracy_score,0) +
                    COALESCE(r.overall_merit_score,0) +
                    COALESCE(r.english_level_score,0)
                ), 0) as avg_score
            FROM reviews r
            LEFT JOIN submissions s ON r.article_id = s.revision_id
              AND s.id = (SELECT MIN(id) FROM submissions WHERE revision_id = r.article_id)
            WHERE r.reviewer_email = ? 
            AND (r.review_status = 'review_submitted' OR r.review_status = 'submitted' OR r.review_status = 'completed')
        `;

        if (search) {
            statsQuery += ` AND (s.title LIKE ? OR s.revision_id LIKE ? OR r.overall_recommendation LIKE ?)`;
        }
        if (recommendation !== 'all') {
            statsQuery += ` AND r.overall_recommendation = ?`;
        }
        if (timing === 'on_time') {
            statsQuery += ` AND COALESCE(r.date_completed, r.date_created) <= DATE_ADD(r.date_created, INTERVAL 30 DAY)`;
        } else if (timing === 'late') {
            statsQuery += ` AND COALESCE(r.date_completed, r.date_created) > DATE_ADD(r.date_created, INTERVAL 30 DAY)`;
        }
        if (editorStatus === 'notified') {
            statsQuery += ` AND (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status IN ('pending', 'invite_sent')) > 0 AND (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status = 'completed') = 0`;
        } else if (editorStatus === 'decided') {
            statsQuery += ` AND (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status = 'completed') > 0`;
        } else if (editorStatus === 'not_notified') {
            statsQuery += ` AND (SELECT COUNT(*) FROM invitations inv WHERE inv.invitation_link = r.article_id AND inv.invited_for = 'To Decide' AND inv.invitation_status IN ('pending', 'invite_sent', 'completed')) = 0`;
        }

        const [statsResult] = await db.promise().query(statsQuery, countParams);

        const stats = {
            total: statsResult[0]?.total || 0,
            onTime: statsResult[0]?.on_time || 0,
            late: statsResult[0]?.late || 0,
            avgScore: Math.round(statsResult[0]?.avg_score || 0)
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