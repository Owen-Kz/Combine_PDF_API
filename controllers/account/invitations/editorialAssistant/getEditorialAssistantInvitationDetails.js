// controllers/account/invitations/editorialAssistant/getEditorialAssistantInvitationDetails.js
// Public: validates an editorial-assistant invitation link and reports its
// status plus whether the invitee already has an account.
const dbPromise = require("../../../../routes/dbPromise.config");

const INVITED_FOR = "editorial_assistant";

const getEditorialAssistantInvitationDetails = async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    const [invitations] = await dbPromise.query(
      `SELECT invitation_link, invited_user, invited_user_name, invitation_status,
              invitation_expiry_date, invitation_date
       FROM invitations
       WHERE invitation_link = ? AND invited_user = ? AND invited_for = ?`,
      [token, email, INVITED_FOR]
    );

    if (invitations.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Invitation not found. Please check your invitation link."
      });
    }

    const invitation = invitations[0];

    if (invitation.invitation_status === "accepted") {
      return res.status(200).json({
        status: "processed",
        invitationStatus: "accepted",
        message: "You have already accepted this invitation",
        alreadyProcessed: true
      });
    }

    if (invitation.invitation_status === "rejected") {
      return res.status(200).json({
        status: "processed",
        invitationStatus: "rejected",
        message: "You have already declined this invitation",
        alreadyProcessed: true
      });
    }

    const now = new Date();
    const expiry = invitation.invitation_expiry_date
      ? new Date(`${invitation.invitation_expiry_date}T23:59:59`)
      : null;

    if (expiry && expiry < now) {
      return res.status(200).json({
        status: "expired",
        invitationStatus: "expired",
        message: "This invitation has expired",
        alreadyProcessed: false
      });
    }

    const [userRows] = await dbPromise.query(
      "SELECT email, is_editor FROM authors_account WHERE email = ?",
      [email]
    );

    const alreadyEditor =
      userRows.length > 0 &&
      (userRows[0].is_editor === "yes" || userRows[0].is_editor === "1");

    return res.json({
      status: "success",
      message: "Invitation is valid",
      invitation: {
        email: invitation.invited_user,
        fullname: invitation.invited_user_name || "",
        status: invitation.invitation_status,
        expiryDate: invitation.invitation_expiry_date,
        invitedAt: invitation.invitation_date
      },
      userExists: userRows.length > 0,
      alreadyEditor
    });
  } catch (error) {
    console.error("Error getting editorial assistant invitation details:", error);
    return res.status(500).json({
      status: "error",
      message: process.env.NODE_ENV === "development" ? error.message : "Failed to load invitation"
    });
  }
};

module.exports = getEditorialAssistantInvitationDetails;