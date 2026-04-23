// controllers/invitations/acceptEditor.js
const db = require("../../../../routes/db.config");
const dbPromise = require("../../../../routes/dbPromise.config");
const sendConfirmationEmail = require("../reviewer/sendConfirmationEmail");
const acceptEditor = async (req, res) => {
  let connection;
  try {
    const { articleId, email, token } = req.body;

    if (!articleId || !email || !token) {
      return res.status(400).json({ 
        status: "error", 
        message: "Missing required fields" 
      });
    }

    connection = await dbPromise;
    await connection.beginTransaction();

    // First check if invitation exists and get its status from invitations table
    const [invitationRecord] = await connection.query(
      `SELECT * FROM invitations 
       WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'To Edit'`,
      [articleId, email]
    );

    if (invitationRecord.length > 0) {
      const status = invitationRecord[0].invitation_status;
      
      // Check if already accepted
      if (status === 'accepted') {
        return res.status(400).json({ 
          status: "error", 
          message: "This invitation has already been accepted and cannot be accepted again" 
        });
      }
      
      // Check if already declined
      if (status === 'rejected') {
        return res.status(400).json({ 
          status: "error", 
          message: "This invitation was previously declined and can no longer be accepted" 
        });
      }
      
      // Check if expired
      if (status === 'expired') {
        return res.status(400).json({ 
          status: "error", 
          message: "This invitation has expired and can no longer be accepted" 
        });
      }
    }

    // Find the invitation in submitted_for_edit table
    const [invitation] = await connection.query(
      `SELECT * FROM submitted_for_edit 
       WHERE article_id = ? AND editor_email = ? AND status = 'submitted_for_edit'`,
      [articleId, email]
    );

    if (invitation.length === 0) {
      // Check if there's a record with different status to give appropriate message
      const [existingRecord] = await connection.query(
        `SELECT status FROM submitted_for_edit 
         WHERE article_id = ? AND editor_email = ?`,
        [articleId, email]
      );

      if (existingRecord.length > 0) {
        const currentStatus = existingRecord[0].status;
        
        if (currentStatus === 'edit_invitation_accepted') {
          return res.status(400).json({ 
            status: "error", 
            message: "You have already accepted this invitation" 
          });
        } else if (currentStatus === 'edit_request_rejected') {
          return res.status(400).json({ 
            status: "error", 
            message: "You have already declined this invitation" 
          });
        } else if (currentStatus === 'edit_completed') {
          return res.status(400).json({ 
            status: "error", 
            message: "This editorial task has already been completed" 
          });
        }
      }
      
      return res.status(404).json({ 
        status: "error", 
        message: "Invitation not found" 
      });
    }

    const editor_email = invitation[0].submitted_by;

    // Check if editor exists in authors_account
    const [existingEditor] = await connection.query(
      "SELECT * FROM authors_account WHERE email = ?",
      [email]
    );

    if (existingEditor.length === 0) {
      // Editor doesn't have an account yet
      return res.status(200).json({
        status: "info",
        message: "Please create an account first",
        requiresAccount: true
      });
    }

    // Update editor status
    await connection.query(
      "UPDATE authors_account SET is_reviewer = 'yes', is_available_for_review = 'yes', is_editor = 'yes' WHERE email = ?",
      [email]
    );

    // Update submission status
    await connection.query(
      "UPDATE submissions SET status = 'edit_invitation_accepted' WHERE revision_id = ?",
      [articleId]
    );

    // Update invitation status in submitted_for_edit
    await connection.query(
      "UPDATE submitted_for_edit SET status = 'edit_invitation_accepted' WHERE article_id = ? AND editor_email = ?",
      [articleId, email]
    );

    // Update invitation status in invitations table
    await connection.query(
      "UPDATE invitations SET invitation_status = 'accepted' WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'To Edit'",
      [articleId, email]
    );

    await connection.commit();

    // Send confirmation email
    await sendConfirmationEmail(editor_email, email, "accepted");

    return res.json({ 
      status: "success", 
      message: "Editor invitation accepted successfully"
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error accepting editor invitation:", error);
    return res.status(500).json({ 
      status: "error", 
      message: error.message 
    });
  }
};

module.exports = acceptEditor;