const db = require("../../../routes/db.config");
const isAdminAccount = require("../isAdminAccount");

const declineInvitation = async (req, res) => {
    try {
        const userEmail = req.user.email;
        const userId = req.user.id;
        const { invitationId, manuscriptId, reason } = req.body;

        if (!invitationId || !manuscriptId) {
            return res.status(400).json({ 
                error: "Missing parameters", 
                message: "Invitation ID and Manuscript ID are required" 
            });
        }

        // Check if user is admin or editor
        const isAdmin = await isAdminAccount(userId);

        // First, check if invitation exists and is pending
        const [invitation] = await db.promise().query(
            "SELECT * FROM invitations WHERE id = ? AND invited_user = ? AND invited_for = 'To Edit'",
            [invitationId, userEmail]
        );

        if (invitation.length === 0) {
            return res.status(404).json({ 
                error: "Invitation not found",
                message: "The invitation does not exist or you don't have permission to access it"
            });
        }

        const inv = invitation[0];

        // Check if invitation can be declined
        if (inv.invitation_status !== 'invite_sent' && inv.invitation_status !== 'pending') {
            return res.status(400).json({ 
                error: "Invalid invitation status",
                message: `This invitation cannot be declined because it is already ${inv.invitation_status}`
            });
        }

        // Update invitation status to 'declined'
        await db.promise().query(
            "UPDATE invitations SET invitation_status = 'declined' WHERE id = ?",
            [invitationId]
        );

        // Optionally store the decline reason in a separate table or log
        if (reason) {
            console.log(`Decline reason for invitation ${invitationId}: ${reason}`);
            // You could create a declined_invitations table to store reasons
        }

        // Log the action
        console.log(`Editor ${userEmail} declined invitation for manuscript ${manuscriptId}`);

        return res.json({
            success: true,
            message: "Invitation declined successfully",
            invitationId,
            manuscriptId,
            status: 'declined'
        });

    } catch (error) {
        console.error("Error declining invitation:", error);
        return res.status(500).json({ 
            error: "Failed to decline invitation", 
            message: error.message 
        });
    }
};

module.exports = declineInvitation;