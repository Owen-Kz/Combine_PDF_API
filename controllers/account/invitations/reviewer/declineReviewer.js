// controllers/invitations/declineReviewer.js
const db = require("../../../../routes/db.config");
const sendConfirmationEmail = require("./sendConfirmationEmail");
const { LogAction } = require("../../../../Logger");

// Terminal statuses that mean the invitation can no longer be declined.
// Centralized so adding a new status means one line, not scattered ifs.
const TERMINAL_STATUS_MESSAGES = {
  accepted: "This invitation has already been accepted and cannot be declined",
  rejected: "You have already declined this invitation",
  declined: "You have already declined this invitation",
  expired: "This invitation has already expired",
  canceled: "This invitation has been canceled",
  completed: "This invitation is already complete",
  review_submitted: "A review has already been submitted for this invitation",
};

// Statuses from which a decline is valid.
const DECLINABLE_STATUSES = ['invite_sent', 'pending'];

const declineReviewer = async (req, res) => {
  let connection;
  try {
    const { articleId, email, token } = req.body;

    if (!articleId || !email || !token) {
      return res.status(400).json({
        status: "error",
        message: "Missing required fields",
      });
    }

    connection = await db.promise();
    await connection.beginTransaction();

    // ───────────────────────────────────────────────────────────────────────
    // Single source of truth: the invitations table.
    // FOR UPDATE locks the row so a concurrent accept can't race.
    // ───────────────────────────────────────────────────────────────────────
    const [invitationRows] = await connection.query(
      `SELECT id, invitation_status, invited_user_name
         FROM invitations
        WHERE invitation_link = ?
          AND invited_user = ?
          AND invited_for = 'Submission Review'
        LIMIT 1
        FOR UPDATE`,
      [articleId, email]
    );

    if (invitationRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: "error",
        message: "Invitation not found",
      });
    }

    const invitation = invitationRows[0];

    // Reject terminal statuses with the appropriate message.
    const terminalMessage = TERMINAL_STATUS_MESSAGES[invitation.invitation_status];
    if (terminalMessage) {
      await connection.rollback();
      return res.status(400).json({
        status: "error",
        message: terminalMessage,
      });
    }

    // Only explicitly-declinable statuses proceed.
    if (!DECLINABLE_STATUSES.includes(invitation.invitation_status)) {
      await connection.rollback();
      return res.status(400).json({
        status: "error",
        message: `This invitation cannot be declined because its status is "${invitation.invitation_status}"`,
      });
    }

    // ───────────────────────────────────────────────────────────────────────
    // Update the invitation + the manuscript row.
    // ───────────────────────────────────────────────────────────────────────
    await connection.query(
      `UPDATE invitations
          SET invitation_status = 'rejected',
              response_date = NOW()
        WHERE id = ?`,
      [invitation.id]
    );

    await connection.query(
      `UPDATE submissions
          SET status = 'review_request_rejected'
        WHERE revision_id = ?`,
      [articleId]
    );

    await connection.commit();

    // ───────────────────────────────────────────────────────────────────────
    // Post-commit side effects — best-effort, never fail the decline.
    // ───────────────────────────────────────────────────────────────────────
    try {
      const editorEmail = invitation.invited_user_name || null;
      if (editorEmail) {
        await sendConfirmationEmail(editorEmail, email, "rejected");
      }
    } catch (emailError) {
      LogAction(`Confirmation email failed (decline reviewer): ${emailError.message}`, "ERROR");
    }

    return res.json({
      status: "success",
      message: "Review invitation declined successfully",
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) { /* swallow */ }
    }
    LogAction(`Error declining review invitation: ${error.message}`, "ERROR");
    return res.status(500).json({
      status: "error",
      message: "Failed to decline invitation",
    });
  }
};

module.exports = declineReviewer;