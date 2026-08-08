// backend/controllers/reviewers/inviteEditorDecision.js
// Allows a reviewer who has submitted a review to (re)invite the responsible
// editor to make a decision on the manuscript.
const db = require("../../routes/db.config");
const { notifyEditorForDecision } = require("../editors/decisions/inviteEditorForDecision");

const inviteEditorDecision = async (req, res) => {
    try {
        const { manuscriptId } = req.body;
        const userEmail = req.user?.email;

        if (!userEmail) {
            return res.status(401).json({ status: "error", message: "Authentication required" });
        }
        if (!manuscriptId) {
            return res.status(400).json({ status: "error", message: "Manuscript ID is required" });
        }

        // Only a reviewer who has actually submitted a review may invite the editor
        const [reviewRows] = await db.promise().query(
            `SELECT id FROM reviews 
             WHERE article_id = ? AND reviewer_email = ? AND review_status = 'review_submitted'`,
            [manuscriptId, userEmail]
        );
        if (reviewRows.length === 0) {
            return res.status(403).json({
                status: "error",
                message: "Only a reviewer who has submitted a review can invite the editor"
            });
        }

        // Block re-inviting once a final decision has already been made. An
        // open (pending/invite_sent) invitation means the editor has not
        // decided yet, so a manual nudge is still allowed.
        const [decisionRows] = await db.promise().query(
            `SELECT
                MAX(CASE WHEN invitation_status = 'completed' THEN 1 ELSE 0 END) AS has_completed,
                MAX(CASE WHEN invitation_status IN ('pending', 'invite_sent') THEN 1 ELSE 0 END) AS has_open
             FROM invitations
             WHERE invitation_link = ? AND invited_for = 'To Decide'`,
            [manuscriptId]
        );
        if (decisionRows[0]?.has_completed && !decisionRows[0]?.has_open) {
            return res.status(400).json({
                status: "error",
                message: "A decision has already been made for this manuscript"
            });
        }

        const result = await notifyEditorForDecision({
            articleId: manuscriptId,
            invitedByEmail: userEmail,
            resend: true
        });

        if (!result.invited) {
            return res.status(400).json({
                status: "error",
                message: result.message || "Could not notify the editor"
            });
        }

        return res.json({
            status: "success",
            message: result.message,
            editors: result.editors
        });
    } catch (error) {
        console.error("Error inviting editor for decision:", error);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
};

module.exports = inviteEditorDecision;
