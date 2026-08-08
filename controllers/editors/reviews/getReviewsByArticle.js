const db = require("../../../routes/db.config");
const isAdminAccount = require("../isAdminAccount");
const { SECTION1_FIELDS, SECTION2_FIELDS } = require("./scoreFields");

const getReviewsByArticle = async (req, res) => {
    try {
        const { articleId } = req.body;
        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Not authenticated" });
        }

        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ success: false, message: "You do not have permission to perform this action" });
        }

        if (!articleId) {
            return res.status(400).json({ success: false, message: "Article ID is required" });
        }

        // Get manuscript data (dedup)
        const [manuscriptResults] = await db.promise().query(
            `SELECT revision_id, title, article_type, discipline FROM submissions
             WHERE revision_id = ? AND id = (SELECT MIN(id) FROM submissions WHERE revision_id = ?)`,
            [articleId, articleId]
        );

        const manuscript = manuscriptResults[0] || null;

        // Get submitted reviews for this manuscript
        const [reviews] = await db.promise().query(
            `SELECT r.*, CONCAT_WS(' ', a.prefix, a.firstname, a.lastname) AS reviewer_name
             FROM reviews r
             LEFT JOIN authors_account a ON r.reviewer_email = a.email
             WHERE r.article_id = ?
               AND r.review_status IN ('review_submitted', 'submitted', 'completed')
             ORDER BY r.id ASC`,
            [articleId]
        );

        const formatted = reviews.map((review) => {
            const section1Total = SECTION1_FIELDS.reduce((sum, f) => sum + (parseInt(review[f.field]) || 0), 0);
            const section2Total = SECTION2_FIELDS.reduce((sum, f) => sum + (parseInt(review[f.field]) || 0), 0);
            return {
                id: review.id,
                review_id: review.review_id,
                article_id: review.article_id,
                reviewer_email: review.reviewer_email,
                reviewer_name: (review.reviewer_name || '').trim() || review.reviewer_email.split('@')[0] || 'Anonymous',
                recommendation: review.overall_recommendation || 'Not specified',
                status: review.review_status,
                section1Total,
                section2Total,
                overallTotal: section1Total + section2Total,
                submittedDate: review.date_completed || review.date_created
            };
        });

        return res.json({ success: true, manuscript, reviews: formatted });
    } catch (error) {
        console.error("Error fetching reviews by article:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = getReviewsByArticle;
