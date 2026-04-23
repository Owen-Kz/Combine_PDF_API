// controllers/invitations/declineEditor.js
const db = require("../../../../routes/db.config");
const sendConfirmationEmail = require("../reviewer/sendConfirmationEmail");

const declineEditor = async (req, res) => {
  let connection;
  try {
    const { articleId, email, token } = req.body;

    if (!articleId || !email || !token) {
      return res.status(400).json({ 
        status: "error", 
        message: "Missing required fields" 
      });
    }

    connection = await db.promise();
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
          message: "This invitation has already been accepted and cannot be declined" 
        });
      }
      
      // Check if already declined
      if (status === 'rejected') {
        return res.status(400).json({ 
          status: "error", 
          message: "You have already declined this invitation" 
        });
      }
      
      // Check if expired
      if (status === 'expired') {
        return res.status(400).json({ 
          status: "error", 
          message: "This invitation has already expired" 
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
            message: "You have already accepted this invitation and cannot decline it now" 
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

    // Update submission status
    await connection.query(
      "UPDATE submissions SET status = 'edit_request_rejected' WHERE revision_id = ?",
      [articleId]
    );

    // Update invitation status in submitted_for_edit
    await connection.query(
      "UPDATE submitted_for_edit SET status = 'edit_request_rejected' WHERE article_id = ? AND editor_email = ?",
      [articleId, email]
    );

    // Update invitation status in invitations table
    await connection.query(
      "UPDATE invitations SET invitation_status = 'rejected' WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'To Edit'",
      [articleId, email]
    );

    await connection.commit();

    // Send confirmation email
    await sendConfirmationEmail(editor_email, email, "rejected");

    return res.json({ 
      status: "success", 
      message: "Editor invitation declined successfully"
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error declining editor invitation:", error);
    return res.status(500).json({ 
      status: "error", 
      message: error.message 
    });
  }
};

module.exports = declineEditor;