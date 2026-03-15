const db = require("../../../../../routes/db.config");



const acceptReviewerInvitation = async (req, res) => {
    try {
        const userEmail = req.user.email;
        const userId = req.user.id;
        const { invitationId, manuscriptId } = req.body;

        if (!invitationId || !manuscriptId) {
            return res.status(400).json({ 
                error: "Missing parameters", 
                message: "Invitation ID and Manuscript ID are required" 
            });
        }

     

        // First, check if invitation exists and is pending
        const [invitation] = await db.promise().query(
            "SELECT * FROM invitations WHERE id = ? AND invited_user = ? AND invited_for = 'Submission Review'",
            [invitationId, userEmail]
        );

        if (invitation.length === 0) {
            return res.status(404).json({ 
                error: "Invitation not found",
                message: "The invitation does not exist or you don't have permission to access it"
            });
        }

        const inv = invitation[0];

        // Check if invitation can be accepted
        if (inv.invitation_status !== 'invite_sent' && inv.invitation_status !== 'pending') {
            return res.status(400).json({ 
                error: "Invalid invitation status",
                message: `This invitation cannot be accepted because it is already ${inv.invitation_status}`
            });
        }

        // Check if invitation has expired
        if (inv.invitation_expiry_date && new Date(inv.invitation_expiry_date) < new Date()) {
            return res.status(400).json({ 
                error: "Invitation expired",
                message: "This invitation has expired and cannot be accepted"
            });
        }

        // Update invitation status to 'accepted'
        await db.promise().query(
            "UPDATE invitations SET invitation_status = 'accepted' WHERE id = ?",
            [invitationId]
        );

        // Insert into submitted_for_edit table
        await db.promise().query(
            "INSERT INTO submitted_for_edit (article_id, editor_email, status) VALUES (?, ?, 'edit_invitation_accepted')",
            [manuscriptId, userEmail]
        );

        // Log the action
        console.log(`Editor ${userEmail} accepted invitation for manuscript ${manuscriptId}`);

        return res.json({
            success: true,
            message: "Invitation accepted successfully",
            invitationId,
            manuscriptId,
            status: 'accepted'
        });

    } catch (error) {
        console.error("Error accepting invitation:", error);
        return res.status(500).json({ 
            error: "Failed to accept invitation", 
            message: error.message 
        });
    }
};

module.exports = acceptReviewerInvitation;