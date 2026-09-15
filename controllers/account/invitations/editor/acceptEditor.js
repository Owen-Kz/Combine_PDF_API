// controllers/invitations/acceptEditor.js
const db = require("../../../../routes/db.config");
const dbPromise = require("../../../../routes/dbPromise.config");
const sendConfirmationEmail = require("../reviewer/sendConfirmationEmail");
const { sendEditorWelcomeEmail } = require("../../../utils/sendWelcomeEmail");
const generateInvitationSession = require("../generateInvitationSession");
const { LogAction } = require("../../../../Logger");
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

    connection = await dbPromise.getConnection();
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
      `SELECT * FROM invitations 
       WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'To Edit'`,
      [articleId, email]
    );

    if (invitation.length === 0) {
      // Check if there's a record with different status to give appropriate message
      const [existingRecord] = await connection.query(
        `SELECT invitation_status FROM invitations 
         WHERE invitation_link = ? AND invited_user = ?`,
        [articleId, email]
      );
      console.log(articleId, email, "BAKSKM")

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

    // If user doesn't exist in authors_account, they need to create an account first
    if (existingEditor.length === 0) {
      return res.status(200).json({
        status: "info",
        message: "Please create an account first",
        requiresAccount: true
      });
    }

    const isAlreadyEditor = existingEditor[0].is_editor === 'yes' || existingEditor[0].is_editor === '1';

    // If user exists but is NOT already an editor, promote them:
    // 1. Set is_editor='yes' and is_reviewer='yes' in authors_account
    // 2. Migrate their details to the editors table
    if (!isAlreadyEditor) {
      await connection.query(
        "UPDATE authors_account SET is_editor = 'yes', is_reviewer = 'yes', is_available_for_review = 'yes' WHERE email = ?",
        [email]
      );

      // Check if they already have an editors record (shouldn't, but be safe)
      const [existingEditorRecord] = await connection.query(
        "SELECT email FROM editors WHERE email = ?",
        [email]
      );

      if (existingEditorRecord.length === 0) {
        // Build fullname from authors_account data
        const editorRow = existingEditor[0];
        const fullname = [editorRow.prefix, editorRow.firstname, editorRow.lastname, editorRow.othername]
          .filter(part => part && part.trim())
          .join(' ')
          .trim();

        // Insert into editors table with sectional_editor level and blank editorial_section
        await connection.query(
          `INSERT INTO editors (email, fullname, password, token, editorial_level, editorial_section) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            email,
            fullname,
            editorRow.password,
            '',
            'sectional_editor',
            ''
          ]
        );
      }
    }

    // Ensure reviewer flags are set
    await connection.query(
      "UPDATE authors_account SET is_reviewer = 'yes', is_available_for_review = 'yes' WHERE email = ?",
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

    // Re-fetch the (now-updated) editor record so the session reflects the
    // current is_editor / is_reviewer flags
    const [updatedEditor] = await connection.query(
      "SELECT * FROM authors_account WHERE email = ?",
      [email]
    );
    const editorRow = updatedEditor[0] || existingEditor[0];

    // Generate a login session so the editor lands logged-in on their dashboard
    const { token: sessionToken, user: sessionUser } = await generateInvitationSession(
      req,
      res,
      editorRow,
      (sql, params) => connection.query(sql, params)
    );

    // Send confirmation email to the inviting editor (never blocks acceptance)
    try {
      await sendConfirmationEmail(editor_email, email, "accepted");
    } catch (emailError) {
      LogAction(`Confirmation email to editor failed (accept editor): ${emailError.message}`, "ERROR");
    }

    // Send welcome email to the newly-accepted editor
    const editorData = existingEditor[0];
    sendEditorWelcomeEmail({
      email,
      firstName: editorData.firstname || '',
      lastName: editorData.lastname || ''
    }).catch(err => LogAction(`Failed to send editor welcome email: ${err.message}`, "ERROR"));

    return res.json({ 
      status: "success", 
      message: "Editor invitation accepted successfully",
      token: sessionToken,
      user: sessionUser,
      redirectTo: "/editors/dashboard"
    });

  } catch (error) {
    if (connection) await connection.rollback();
    LogAction(`Error accepting editor invitation: ${error.message}`, "ERROR");
    return res.status(500).json({ 
      status: "error", 
      message: error.message 
    });
  }
};

module.exports = acceptEditor;