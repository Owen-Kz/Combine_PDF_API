// controllers/invitations/acceptReviewer.js
const db = require("../../../../routes/db.config");
const sendConfirmationEmail = require("./sendConfirmationEmail");

const acceptReviewer = async (req, res) => {
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
       WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'Submission Review'`,
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

    // Find the invitation in submitted_for_review table
    const [invitation] = await connection.query(
      `SELECT * FROM submitted_for_review 
       WHERE article_id = ? AND reviewer_email = ? AND status = 'submitted_for_review'`,
      [articleId, email]
    );

    if (invitation.length === 0) {
      // Check if there's a record with different status to give appropriate message
      const [existingRecord] = await connection.query(
        `SELECT status FROM submitted_for_review 
         WHERE article_id = ? AND reviewer_email = ?`,
        [articleId, email]
      );

      if (existingRecord.length > 0) {
        const currentStatus = existingRecord[0].status;
        
        if (currentStatus === 'review_invitation_accepted') {
          return res.status(400).json({ 
            status: "error", 
            message: "You have already accepted this invitation" 
          });
        } else if (currentStatus === 'review_request_rejected') {
          return res.status(400).json({ 
            status: "error", 
            message: "You have already declined this invitation" 
          });
        } else if (currentStatus === 'review_submitted') {
          return res.status(400).json({ 
            status: "error", 
            message: "A review has already been submitted for this invitation" 
          });
        }
      }
      
      return res.status(404).json({ 
        status: "error", 
        message: "Invitation not found" 
      });
    }

    const editor_email = invitation[0].submitted_by;

    // Check if reviewer exists in authors_account
    const [existingReviewer] = await connection.query(
      "SELECT * FROM authors_account WHERE email = ?",
      [email]
    );

    if (existingReviewer.length === 0) {
      // Reviewer doesn't have an account yet
      return res.status(200).json({
        status: "info",
        message: "Please create an account first",
        requiresAccount: true
      });
    }

    // Update reviewer status
    await connection.query(
      "UPDATE authors_account SET is_reviewer = 'yes', is_available_for_review = 'yes' WHERE email = ?",
      [email]
    );

    // Update submission status
    await connection.query(
      "UPDATE submissions SET status = 'review_invitation_accepted' WHERE revision_id = ?",
      [articleId]
    );

    // Update invitation status in submitted_for_review
    await connection.query(
      "UPDATE submitted_for_review SET status = 'review_invitation_accepted' WHERE article_id = ? AND reviewer_email = ?",
      [articleId, email]
    );

    // Update invitation status in invitations table
    await connection.query(
      "UPDATE invitations SET invitation_status = 'accepted' WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'Submission Review'",
      [articleId, email]
    );

    await connection.commit();

    // Send confirmation email
    await sendConfirmationEmail(editor_email, email, "accepted");

    return res.json({ 
      status: "success", 
      message: "Review invitation accepted successfully"
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error accepting review invitation:", error);
    return res.status(500).json({ 
      status: "error", 
      message: error.message 
    });
  }
};

module.exports = acceptReviewer;