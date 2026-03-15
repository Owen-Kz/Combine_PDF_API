// backend/controllers/author/getDecisionLetter.js
const db = require("../../routes/db.config");

const getDecisionLetter = async (req, res) => {
    try {
        const userEmail = req.user.email; // From auth middleware
        const { articleId } = req.params;

        if (!userEmail) {
            return res.status(400).json({ 
                status: "error", 
                message: "User email not found" 
            });
        }

        if (!articleId) {
            return res.status(400).json({ 
                status: "error", 
                message: "Article ID is required" 
            });
        }

        // Get the submission details
        const [submission] = await db.promise().query(
            `SELECT 
                revision_id,
                title,
                article_type as type,
                status,
                date_submitted as submittedDate,
                abstract
             FROM submissions 
             WHERE revision_id = ? AND corresponding_authors_email = ?`,
            [articleId, userEmail]
        );

        if (submission.length === 0) {
            return res.status(404).json({ 
                status: "error", 
                message: "Submission not found" 
            });
        }

        // Get decision letter from sent_emails table
        const [decisionLetters] = await db.promise().query(
            `SELECT 
                id,
                subject,
                sender,
                recipient,
                body,
                status,
                email_for,
                sent_at,
                date_sent
             FROM sent_emails 
             WHERE article_id = ? 
             AND recipient = ? 
             AND email_for IN ('accept_paper', 'reject_paper', 'return_for_correction', 'return_for_revision')
             ORDER BY sent_at DESC
             LIMIT 1`,
            [articleId, userEmail]
        );

        // Get reviewer comments from reviews table (if any)
        // const [reviewerComments] = await db.promise().query(
        //     `SELECT 
        //         reviewer_email,
        //         overall_recommendation,
        //         date_completed
        //      FROM reviews 
        //      WHERE article_id = ? 
        //      AND status = 'completed'
        //      ORDER BY date_completed ASC`,
        //     [articleId]
        // );

        // Format the response
        const response = {
            status: "success",
            submission: submission[0],
            decisionLetter: decisionLetters.length > 0 ? {
                id: decisionLetters[0].id,
                subject: decisionLetters[0].subject,
                from: decisionLetters[0].sender,
                date: decisionLetters[0].sent_at || decisionLetters[0].date_sent,
                body: decisionLetters[0].body,
                emailFor: decisionLetters[0].email_for
            } : null,
            // reviewerComments: reviewerComments.map(comment => ({
            //     reviewer: comment.reviewer_name || 'Reviewer',
            //     email: comment.reviewer_email,
            //     recommendation: comment.overall_recommendation || 'Not specified',
            //     comments: comment.comments_to_author || '',
            //     confidential: comment.confidential_comments || '',
            //     date: comment.date_completed
            // })),
              reviewerComments:{},
            // Calculate revisions due date (e.g., 30 days from decision date)
            revisionsDue: decisionLetters.length > 0 ? 
                new Date(new Date(decisionLetters[0].sent_at).setDate(new Date(decisionLetters[0].sent_at).getDate() + 30))
                    .toISOString().split('T')[0] : null
        };

        return res.json(response);

    } catch (error) {
        console.error("Error fetching decision letter:", error);
        return res.status(500).json({ 
            status: "error", 
            message: "Internal server error" 
        });
    }
};

module.exports = getDecisionLetter;