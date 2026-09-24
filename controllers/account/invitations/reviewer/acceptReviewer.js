// controllers/invitations/acceptReviewer.js
const db = require("../../../../routes/db.config");
const sendConfirmationEmail = require("./sendConfirmationEmail");
const { sendReviewerWelcomeEmail } = require("../../../utils/sendWelcomeEmail");
const generateInvitationSession = require("../generateInvitationSession");
const { LogAction } = require("../../../../Logger");

// Terminal statuses that mean the invitation can no longer be accepted.
const BLOCKING_STATUS_MESSAGES = {
  accepted: "This invitation has already been accepted",
  rejected: "This invitation was previously declined and can no longer be accepted",
  declined: "This invitation was previously declined and can no longer be accepted",
  expired: "This invitation has expired and can no longer be accepted",
  canceled: "This invitation has been canceled",
  completed: "This invitation is already complete",
  review_submitted: "A review has already been submitted for this invitation",
};

const acceptReviewer = async (req, res) => {
  let connection;
  let responseSent = false;

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
    // FOR UPDATE locks the row so a concurrent accept/decline can't race.
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

    // Block already-resolved invitations with a specific message.
    const blockMessage = BLOCKING_STATUS_MESSAGES[invitation.invitation_status];
    if (blockMessage) {
      await connection.rollback();
      return res.status(400).json({
        status: "error",
        message: blockMessage,
      });
    }

    const ACCEPTABLE = ['invite_sent', 'pending'];
    if (!ACCEPTABLE.includes(invitation.invitation_status)) {
      await connection.rollback();
      return res.status(400).json({
        status: "error",
        message: `This invitation cannot be accepted because its status is "${invitation.invitation_status}"`,
      });
    }

    // ───────────────────────────────────────────────────────────────────────
    // Reviewer account check + promotion
    // ───────────────────────────────────────────────────────────────────────
    const [reviewerRows] = await connection.query(
      `SELECT * FROM authors_account WHERE email = ? LIMIT 1`,
      [email]
    );

    if (reviewerRows.length === 0) {
      await connection.rollback();
      return res.status(200).json({
        status: "info",
        message: "Please create an account first",
        requiresAccount: true,
      });
    }

    const reviewer = reviewerRows[0];

    if (reviewer.is_reviewer !== 'yes') {
      await connection.query(
        `UPDATE authors_account
            SET is_reviewer = 'yes',
                is_available_for_review = 'yes'
          WHERE email = ?`,
        [email]
      );
    }

    // ───────────────────────────────────────────────────────────────────────
    // Update the invitation + the manuscript row.
    // ───────────────────────────────────────────────────────────────────────
    await connection.query(
      `UPDATE invitations
          SET invitation_status = 'accepted',
              acceptance_date = NOW()
        WHERE id = ?`,
      [invitation.id]
    );

    await connection.query(
      `UPDATE submissions
          SET status = 'review_invitation_accepted'
        WHERE revision_id = ?`,
      [articleId]
    );

    await connection.commit();

    // ───────────────────────────────────────────────────────────────────────
    // Post-commit: session, emails
    // ───────────────────────────────────────────────────────────────────────
    const [updatedReviewerRows] = await connection.query(
      `SELECT * FROM authors_account WHERE email = ? LIMIT 1`,
      [email]
    );
    const reviewerRow = updatedReviewerRows[0] || reviewer;

    let sessionToken = null;
    let sessionUser = null;
    try {
      const session = await generateInvitationSession(
        req,
        res,
        reviewerRow,
        (sql, params) => connection.query(sql, params)
      );
      sessionToken = session?.token || null;
      sessionUser = session?.user || null;
    } catch (sessionError) {
      LogAction(`Session generation failed (accept reviewer): ${sessionError.message}`, "ERROR");
    }

    // Confirmation email to the inviter — never blocks the acceptance itself.
    try {
      const editorEmail = invitation.invited_user_name || null;
      if (editorEmail) {
        await sendConfirmationEmail(editorEmail, email, "accepted");
      }
    } catch (emailError) {
      LogAction(`Confirmation email failed (accept reviewer): ${emailError.message}`, "ERROR");
    }

    // Welcome email to the reviewer — fire and forget.
    sendReviewerWelcomeEmail({
      email,
      firstName: reviewer.firstname || '',
      lastName: reviewer.lastname || '',
    }).catch((err) =>
      LogAction(`Failed to send reviewer welcome email: ${err.message}`, "ERROR")
    );

    responseSent = true;

    return res.json({
      status: "success",
      message: "Review invitation accepted successfully",
      token: sessionToken,
      user: sessionUser,
      redirectTo: `/reviewerdash/review/${articleId}&x=${sessionToken || ''}`,
    });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) { /* swallow */ }
    }
    LogAction(`Error accepting review invitation: ${error.message}`, "ERROR");

    if (responseSent) return;
    return res.status(500).json({
      status: "error",
      message: "Failed to accept invitation",
    });
  }
};

module.exports = acceptReviewer;