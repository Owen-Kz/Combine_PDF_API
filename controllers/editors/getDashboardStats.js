// backend/controllers/editors/getDashboardStats.js
const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");

// ---------------------------------------------------------------------------
// CANONICAL ID SPACE
//
// Everything in this file scopes to `submissions.revision_id` — the identifier
// that `invitations.invitation_link`, `reviews.article_id`, and
// `submitted_for_edit.article_id` all resolve to.
//
// If any of those column names differ in your schema, change ONLY the
// corresponding JOIN below. Every count reuses this fragment, so the ID space
// stays consistent everywhere.
// ---------------------------------------------------------------------------
const SCOPED_MANUSCRIPT_IDS = `
  SELECT sfe.article_id AS revision_id
    FROM submitted_for_edit sfe
   WHERE sfe.editor_email = ?
     AND sfe.status = 'edit_invitation_accepted'
  UNION
  SELECT i.invitation_link AS revision_id
    FROM invitations i
   WHERE i.invited_user = ?
     AND (i.invited_for = 'To Edit')
     AND i.invitation_status NOT IN ('declined', 'canceled', 'expired')
`;

const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user?.email;
        const userFullname = req.user?.fullname || userId;

        if (!userId) {
            return res.status(400).json({ success: false, error: "Invalid Parameters" });
        }

        const isAdmin = await isAdminAccount(userId);

        // Two placeholders matching SCOPED_MANUSCRIPT_IDS (editor_email, invited_user).
        const scopeParams = isAdmin ? [] : [userId, userId];

        // Boilerplate-free helper. On error, logs the failing SQL and resolves 0
        // so one broken stat doesn't take down the whole dashboard.
        const countQuery = (sql, params = []) =>
            new Promise((resolve) => {
                db.query(sql, params, (err, results) => {
                    if (err) {
                        console.error("Stat query failed:", err.message);
                        console.error("SQL:", sql.replace(/\s+/g, " ").trim());
                        console.error("Params:", params);
                        resolve(0);
                    } else {
                        resolve(results[0]?.count || 0);
                    }
                });
            });

        // The reusable IN(...) fragment. Admins get an unfiltered full-table count.
        const scopedIn = `IN (${SCOPED_MANUSCRIPT_IDS})`;

        const [
            submissionsCount,
            authorsCount,
            reviewedCount,
            decisionedCount,
            archivedCount,
            editorInvitesCount,
            acceptedCount,
            inboxCount,
            pendingReviewsCount,
            pendingDecisionsCount,
        ] = await Promise.all([
            // ── 1) Submissions — distinct manuscripts the editor is associated with.
            countQuery(
                isAdmin
                    ? `SELECT COUNT(DISTINCT revision_id) AS count FROM submissions`
                    : `SELECT COUNT(DISTINCT revision_id) AS count
                         FROM submissions
                        WHERE revision_id ${scopedIn}`,
                scopeParams
            ),

            // ── 2) Authors — distinct corresponding authors on the editor's manuscripts.
            countQuery(
                isAdmin
                    ? `SELECT COUNT(*) AS count FROM authors_account`
                    : `SELECT COUNT(DISTINCT corresponding_authors_email) AS count
                         FROM submissions
                        WHERE revision_id ${scopedIn}
                          AND corresponding_authors_email IS NOT NULL
                          AND corresponding_authors_email <> ''`,
                scopeParams
            ),

            // ── 3) Reviewed — submitted reviews on the editor's manuscripts.
            //        reviews.article_id is the manuscript's revision_id.
            countQuery(
                isAdmin
                    ? `SELECT COUNT(*) AS count
                         FROM reviews
                        WHERE review_status = 'review_submitted'`
                    : `SELECT COUNT(*) AS count
                         FROM reviews
                        WHERE review_status = 'review_submitted'
                          AND article_id ${scopedIn}`,
                scopeParams
            ),

            // ── 4) Decisioned — manuscripts with a final decision.
            countQuery(
                isAdmin
                    ? `SELECT COUNT(*) AS count
                         FROM submissions
                        WHERE status IN ('accepted','rejected','published',
                                         'returned_for_correction','returned_for_revision')`
                    : `SELECT COUNT(*) AS count
                         FROM submissions
                        WHERE status IN ('accepted','rejected','published',
                                         'returned_for_correction','returned_for_revision')
                          AND revision_id ${scopedIn}`,
                scopeParams
            ),

            // ── 5) Archived — archived manuscripts the editor handled.
            //        Assumes archived_submissions has a revision_id column.
            //        If it uses a different column name, swap it here.
            countQuery(
                isAdmin
                    ? `SELECT COUNT(*) AS count FROM archived_submissions`
                    : `SELECT COUNT(*) AS count
                         FROM archived_submissions
                        WHERE revision_id ${scopedIn}`,
                scopeParams
            ),

            // ── 6) Editor invitations — pending edit invites addressed to this editor.
            countQuery(
                isAdmin
                    ? `SELECT COUNT(*) AS count
                         FROM invitations
                        WHERE invitation_status = 'invite_sent'
                          AND invited_for = 'To Edit'`
                    : `SELECT COUNT(*) AS count
                         FROM invitations
                        WHERE invitation_status = 'invite_sent'
                          AND invited_for = 'To Edit'
                          AND invited_user = ?`,
                isAdmin ? [] : [userId]
            ),

            // ── 7) Accepted — accepted manuscripts the editor handled.
            countQuery(
                isAdmin
                    ? `SELECT COUNT(*) AS count
                         FROM submissions
                        WHERE status IN ('accepted','processed','Accepted')`
                    : `SELECT COUNT(*) AS count
                         FROM submissions
                        WHERE status IN ('accepted','processed','Accepted')
                          AND revision_id ${scopedIn}`,
                scopeParams
            ),

            // ── 8) Inbox — personal to the user, never scoped to manuscripts.
            countQuery(
                `SELECT COUNT(*) AS count
                   FROM sent_emails
                  WHERE recipient = ?
                    AND status IN ('unread','sent','Sent','Delivered')`,
                [userId]
            ),

            // ── 9) Pending reviews — outstanding review invitations on the
            //        editor's manuscripts. `invitation_link` holds the revision_id.
            countQuery(
                isAdmin
                    ? `SELECT COUNT(*) AS count
                         FROM invitations
                        WHERE invitation_status = 'invite_sent'
                          AND invited_for = 'Submission Review'`
                    : `SELECT COUNT(*) AS count
                         FROM invitations
                        WHERE invitation_status = 'invite_sent'
                          AND invited_for = 'Submission Review'
                          AND invitation_link ${scopedIn}`,
                scopeParams
            ),

            // ── 10) Pending decisions — deduped per manuscript.
            //         Editor path: matches on email OR fullname, depending on
            //         which column holds their identity for "To Decide" rows.
            countQuery(
                isAdmin
                    ? `SELECT COUNT(DISTINCT invitation_link) AS count
                         FROM invitations
                        WHERE (invited_for = 'To Decide'
                               AND invitation_status IN ('pending','invite_sent'))
                           OR (invitation_status = 'review_submitted')`
                    : `SELECT COUNT(DISTINCT invitation_link) AS count
                         FROM invitations
                        WHERE (invited_for = 'To Decide'
                               AND invitation_status IN ('pending','invite_sent')
                               AND invited_user = ?)
                           OR (invited_user_name = ?
                               AND invitation_status = 'review_submitted')`,
                isAdmin ? [] : [userId, userFullname]
            ),
        ]);

        return res.json({
            success: true,
            isAdmin,
            stats: {
                submissions: submissionsCount,
                authors: authorsCount,
                reviewed: reviewedCount,
                decisioned: decisionedCount,
                archived: archivedCount,
                editorInvitations: editorInvitesCount,
                accepted: acceptedCount,
                pendingReviews: pendingReviewsCount,
                pendingDecisions: pendingDecisionsCount,
                inbox: inboxCount,
            },
        });
    } catch (error) {
        console.error("getDashboardStats error:", error);
        return res.status(500).json({
            success: false,
            error: "Server error",
            message: error.message,
        });
    }
};

module.exports = getDashboardStats;