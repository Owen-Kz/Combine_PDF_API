// backend/controllers/author/getDashboardStats.js
const db = require("../../routes/db.config");
const dbPromise = require("../../routes/dbPromise.config");

const getDashboardStats = async (req, res) => {
    try {
        const userEmail = req.user.email; // From auth middleware

        if (!userEmail) {
            return res.status(400).json({
                status: "error",
                message: "User email not found"
            });
        }

        // Get stats for author's own submissions - INCLUDING DRAFTS
        const [ownStats] = await db.promise().query(
            `SELECT 
                COUNT(CASE WHEN status = 'submitted' OR status = 'under_review' OR status = 'review_invitation_accepted' OR status = 'review_invitation_rejected' OR status = 'review_submitted' THEN 1 END) as inReview,
                COUNT(CASE WHEN status = 'returned_for_correction' OR status = 'returned_for_revision' THEN 1 END) as returned,
                COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
                COUNT(CASE WHEN status = 'draft' OR status = 'saved' OR status = 'drafted' OR status = 'revision_saved' OR status = 'correction_saved' THEN 1 END) as draft,
                COUNT(*) as submitted
             FROM submissions 
             WHERE corresponding_authors_email = ?`,
            [userEmail]
        );

        // Get count of co-authored manuscripts
        const [coAuthoredEntries] = await db.promise().query(
            `SELECT submission_id
             FROM submission_authors 
             WHERE authors_email = ?`,
            [userEmail]
        );

        let actualCoAuthoredCount = 0;
        const submissionIds = coAuthoredEntries.map(entry => entry.submission_id);
        
        if (submissionIds.length > 0) {
            const [countResult] = await dbPromise.query(
                `SELECT COUNT(*) as count 
                 FROM submissions 
                 WHERE (revision_id IN (?) OR article_id IN (?)) 
                 AND corresponding_authors_email != ?`,
                [submissionIds, submissionIds, userEmail]
            );
            actualCoAuthoredCount = countResult[0]?.count || 0;
        }

        // Get inbox count (unread sent_emails)
        const [inboxCount] = await db.promise().query(
            `SELECT COUNT(*) as count
             FROM sent_emails 
             WHERE recipient = ? 
             AND status IN ('unread', 'sent', 'Sent', 'Delivered')`,
            [userEmail]
        );

        // Calculate manuscripts with decisions (accepted + rejected)
        const withDecisions = (ownStats[0].accepted || 0) + (ownStats[0].rejected || 0);

        return res.json({
            status: "success",
            stats: {
                submitted: ownStats[0].submitted || 0,
                inReview: ownStats[0].inReview || 0,
                coAuthored: actualCoAuthoredCount,
                withDecisions: withDecisions,
                inbox: inboxCount[0].count || 0,
                returned: ownStats[0].returned || 0,
                draft: ownStats[0].draft || 0
            }
        });

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
};

module.exports = getDashboardStats;