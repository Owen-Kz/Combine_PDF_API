// backend/controllers/reviewer/getReviewerStats.js
const db = require("../../routes/db.config");

const getReviewerStats = async (req, res) => {
    try {
        const userEmail = req.user.email; // From auth middleware
        
        if (!userEmail) {
            return res.status(400).json({ 
                status: "error", 
                message: "User email not found" 
            });
        }

        // Get counts for different review statuses
        const [stats] = await db.promise().query(
            `SELECT 
                COUNT(CASE WHEN review_status = 'saved' OR review_status = 'draft' OR review_status = 'in_progress' THEN 1 END) as pendingReviews,
                COUNT(CASE WHEN review_status = 'review_submitted' OR review_status = 'submitted' OR review_status = 'completed' THEN 1 END) as completedReviews,
                COUNT(CASE WHEN DATE_ADD(date_created, INTERVAL 30 DAY) < NOW() 
                           AND (review_status = 'accepted' OR review_status = 'in_progress') THEN 1 END) as overdueReviews
             FROM reviews 
             WHERE reviewer_email = ?`,
            [userEmail]
        );

        // Calculate average score from completed reviews
        const [avgScoreResult] = await db.promise().query(
            `SELECT AVG(
                (novelty_score + quality_score + scientific_accuracy_score + 
                 overall_merit_score + english_level_score) / 5.0
             ) as averageScore
             FROM reviews 
             WHERE reviewer_email = ? 
             AND (review_status = 'review_submitted' OR review_status = 'submitted' OR review_status = 'completed')
             AND novelty_score IS NOT NULL`,
            [userEmail]
        );

        const averageScore = avgScoreResult[0]?.averageScore 
            ? parseFloat(avgScoreResult[0].averageScore).toFixed(1) 
            : 0;

        // Get detailed pending reviews stats from getPendingReviews logic
        const [pendingReviews] = await db.promise().query(
            `SELECT r.*, s.title, s.revision_id
             FROM reviews r
             LEFT JOIN submissions s ON r.article_id = s.revision_id
             WHERE r.reviewer_email = ? 
             AND (r.review_status = 'saved' OR r.review_status = 'draft' OR r.review_status = 'in_progress')`,
            [userEmail]
        );

        // Calculate days left for each pending review
        let urgentCount = 0;
        let highCount = 0;
        let dueThisWeekCount = 0;

        pendingReviews.forEach(review => {
            const submittedDate = new Date(review.date_created);
            const dueDate = new Date(submittedDate);
            dueDate.setDate(dueDate.getDate() + 30);
            const today = new Date();
            const daysLeft = Math.max(0, Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)));

            if (daysLeft <= 3) urgentCount++;
            if (daysLeft <= 7) dueThisWeekCount++;
            if (daysLeft > 3 && daysLeft <= 7) highCount++;
        });

        return res.json({
            success: true,
            stats: {
                pendingReviews: stats[0]?.pendingReviews || 0,
                completedReviews: stats[0]?.completedReviews || 0,
                overdueReviews: stats[0]?.overdueReviews || 0,
                averageScore: averageScore,
                urgentReviews: urgentCount,
                highPriorityReviews: highCount,
                dueThisWeek: dueThisWeekCount
            }
        });

    } catch (error) {
        console.error("Error fetching reviewer stats:", error);
        return res.status(500).json({ 
            success: false,
            message: "Internal server error" 
        });
    }
};

module.exports = getReviewerStats;