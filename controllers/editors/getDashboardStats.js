// backend/controllers/editors/getDashboardStats.js
const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");

const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!userId) {
            return res.json({ error: "Invalid Parameters" });
        }

        const isAdmin = await isAdminAccount(userId);
        // Get all counts in parallel
        const [
            submissionsCount,
            authorsCount,
            reviewedCount,
            decisionedCount,
            archivedCount,
            editorInvitesCount,
            acceptedCount,
            inboxCount,
            prendingReviewsCouunt
        ] = await Promise.all([
            // Submissions count
            new Promise((resolve) => {
                const query = isAdmin 
                    ? `SELECT COUNT(*) AS count FROM submissions WHERE 1`
                    : `SELECT COUNT(*) AS count FROM submitted_for_edit WHERE editor_email = ? AND status = 'edit_invitation_accepted'`;
                console.log(query)
                db.query(query, isAdmin ? [] : [req.user.email], (err, results) => {
                    if (err) resolve(0);
                    else resolve(results[0]?.count || 0);
                });
            }),
            
            // Authors count
            new Promise((resolve) => {
                db.query(`SELECT COUNT(*) AS count FROM authors_account`, (err, results) => {
                    if (err) resolve(0);
                    else resolve(results[0]?.count || 0);
                });
            }),
            
            // Reviewed count
            new Promise((resolve) => {
                db.query(`SELECT COUNT(*) AS count FROM reviews WHERE review_status = 'review_submitted'`, (err, results) => {
                    if (err) resolve(0);
                    else resolve(results[0]?.count || 0);
                });
            }),
            
            // Decisioned count
            new Promise((resolve) => {
                db.query(`SELECT COUNT(*) AS count FROM submissions WHERE status IN ('accepted', 'rejected', 'published')`, (err, results) => {
                    if (err) resolve(0);
                    else resolve(results[0]?.count || 0);
                });
            }),
            
            // Archived count
            new Promise((resolve) => {
                db.query(`SELECT COUNT(*) AS count FROM archived_submissions`, (err, results) => {
                    if (err) resolve(0);
                    else resolve(results[0]?.count || 0);
                });
            }),
            
            // Editor invitations count
            new Promise((resolve) => {
                db.query(`SELECT COUNT(*) AS count FROM invitations WHERE invitation_status = 'invite_sent' AND invited_for = 'To Edit'`, (err, results) => {
                    if (err) resolve(0);
                    else resolve(results[0]?.count || 0);
                });
            }),

            // ACcepted submission count
            new Promise((resolve) => {
                db.query(`SELECT COUNT(*) AS count FROM submissions WHERE (status = 'accepted' OR status = 'processed' OR status = 'Accepted')`, (err, results) => {
                    if (err) resolve(0);
                    else resolve(results[0]?.count || 0);
                });
            }),

             //Inbox count
            new Promise((resolve) => {
                db.query(`SELECT COUNT(*) AS count FROM sent_emails WHERE recipient = ? AND status IN ('unread', 'sent', 'Sent', 'Delivered')`, [req.user.email], (err, results) => {
                    if (err) resolve(0);
                    
                    else resolve(results[0]?.count || 0);

                });
            }),

            // Pending reviees count 
             new Promise((resolve) => {
                db.query(`SELECT COUNT(*) AS count FROM invitations WHERE invitation_status = 'invite_sent' AND invited_for = 'Submission Review'`, (err, results) => {
                    if (err) resolve(0);
                    else resolve(results[0]?.count || 0);
                });
            })
        ]);

        return res.json({
            success: true,
            stats: {
                submissions: submissionsCount,
                authors: authorsCount,
                reviewed: reviewedCount,
                decisioned: decisionedCount,
                archived: archivedCount,
                editorInvitations: editorInvitesCount,
                accepted:acceptedCount,
                pendingReviews: prendingReviewsCouunt,
                inbox:inboxCount,
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Server error", message: error.message });
    }
};

module.exports = getDashboardStats;