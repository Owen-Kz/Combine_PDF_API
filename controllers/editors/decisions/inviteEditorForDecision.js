// Shared helper: notifies the responsible editor(s) that a manuscript is
// awaiting an editorial decision. Used automatically after a review is
// submitted (see controllers/reviewers/submitReviews.js) and by the manual
// "Invite Editor" action on the reviewer dashboard.
const mysql = require("mysql2/promise");
const Brevo = require("@getbrevo/brevo");
const dotenv = require("dotenv");
const saveEmailDetails = require("../../account/invitations/saveEmail");

dotenv.config();

const dbConfig = {
  host: process.env.D_HOST,
  user: process.env.D_USER,
  password: process.env.D_PASSWORD,
  database: process.env.D_NAME,
};

/**
 * Resolve the responsible editor(s) for an article.
 * Priority:
 *   1. Explicitly requested editor
 *   2. Handling editors who sent reviewer invitations (submitted_for_review)
 *   3. Editors who accepted a 'To Edit' invitation for this revision
 *   4. Editors recorded in submitted_for_edit for this article (by revision
 *      or base article id)
 *   5. Editor-in-Chief / Admin fallback
 */
const resolveResponsibleEditors = async (connection, submission, editorEmail) => {
  if (editorEmail) {
    return [editorEmail];
  }

  const articleId = submission.revision_id;
  const editors = [];
  const seen = new Set();
  const push = (email) => {
    if (email && !seen.has(email)) {
      seen.add(email);
      editors.push(email);
    }
  };

  // Handling editors: the editor(s) who sent reviewer invitations for this
  // manuscript. These are the primary recipients of the review-submitted
  // notification.
  const [handlingEditors] = await connection.execute(
    "SELECT DISTINCT submitted_by FROM submitted_for_review WHERE (article_id = ? OR article_id = ?) AND submitted_by IS NOT NULL AND submitted_by != ''",
    [articleId, submission.article_id]
  );
  handlingEditors.forEach((r) => push(r.submitted_by));

  const [acceptedEditInvitations] = await connection.execute(
    "SELECT DISTINCT invited_user FROM invitations WHERE invitation_link = ? AND invited_for = 'To Edit' AND invitation_status IN ('accepted', 'edit_invitation_accepted', 'edit_submitted')",
    [articleId]
  );
  acceptedEditInvitations.forEach((r) => push(r.invited_user));

  const [assigned] = await connection.execute(
    "SELECT DISTINCT editor_email FROM submitted_for_edit WHERE (article_id = ? OR article_id = ?) AND status = 'edit_invitation_accepted'",
    [articleId, submission.article_id]
  );
  assigned.forEach((r) => push(r.editor_email));

  if (editors.length === 0) {
    const [eic] = await connection.execute(
      "SELECT email FROM editors WHERE editorial_level IN ('editor_in_chief', 'admin') ORDER BY id ASC LIMIT 1"
    );
    if (eic.length > 0) {
      push(eic[0].email);
    }
  }

  return editors;
};

const buildDecisionEmailHtml = (submission, reviewsCount) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const decisionLink = `${frontendUrl}/editors/decision/${submission.revision_id}`;
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #501f46;">Decision Required</h2>
      <p>Dear Editor,</p>
      <p>A manuscript is awaiting your editorial decision:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Manuscript ID</td><td style="padding: 8px; border: 1px solid #ddd;">${submission.revision_id}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Title</td><td style="padding: 8px; border: 1px solid #ddd;">${submission.title || "N/A"}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reviews Submitted</td><td style="padding: 8px; border: 1px solid #ddd;">${reviewsCount}</td></tr>
      </table>
      <p>Please review the manuscript and reviewer reports, then make your decision.</p>
      <p style="text-align: center;">
        <a href="${decisionLink}" style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Review &amp; Make Decision</a>
      </p>
      <p>You can also log into your dashboard to access the manuscript details and all reviewer reports.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 0.85em; color: #666;">ASFI Research Journal Editorial System</p>
    </body>
    </html>
  `;
};

/**
 * Notify the responsible editor(s) that a decision is required for an article.
 *
 * @param {object} options
 * @param {string} options.articleId  revision_id of the manuscript
 * @param {string} [options.editorEmail] explicit editor to invite (defaults to responsible editor)
 * @param {string} [options.invitedByEmail] account triggering the invitation (for sent_emails record)
 * @param {boolean} [options.resend] if true, re-sends the email even when a pending invitation exists
 * @returns {Promise<{invited: boolean, editors: string[], message: string}>}
 */
const notifyEditorForDecision = async ({ articleId, editorEmail = null, invitedByEmail = "system@asfirj.org", resend = false }) => {
  let connection;
  try {
    if (!articleId) {
      return { invited: false, editors: [], message: "Article ID is required" };
    }

    connection = await mysql.createConnection(dbConfig);

    const [submission] = await connection.execute(
      "SELECT revision_id, article_id, title, status FROM submissions WHERE revision_id = ?",
      [articleId]
    );
    if (submission.length === 0) {
      return { invited: false, editors: [], message: "Submission not found" };
    }

    const [reviews] = await connection.execute(
      "SELECT COUNT(*) AS total FROM reviews WHERE article_id = ? AND review_status = 'review_submitted'",
      [articleId]
    );
    if (reviews[0].total === 0) {
      return { invited: false, editors: [], message: "No reviews have been submitted for this manuscript yet" };
    }

    const editors = await resolveResponsibleEditors(connection, submission[0], editorEmail);
    if (editors.length === 0) {
      return { invited: false, editors: [], message: "No responsible editor found for this manuscript" };
    }

    const invited = [];
    const [editorRows] = await connection.execute(
      `SELECT email, fullname FROM editors WHERE email IN (${editors.map(() => "?").join(", ")})`,
      editors
    );
    const editorNames = new Map(editorRows.map((r) => [r.email, r.fullname || r.email]));

    for (const email of editors) {
      const [existing] = await connection.execute(
        "SELECT id FROM invitations WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'To Decide' AND invitation_status IN ('pending', 'invite_sent')",
        [articleId, email]
      );

      if (existing.length > 0 && !resend) {
        // A new review has arrived for an already-open decision invitation.
        // Re-flag it as new for the editor without spamming a duplicate email.
        await connection.execute(
          "UPDATE invitations SET decision_viewed = 0, invitation_status = 'pending' WHERE id = ?",
          [existing[0].id]
        );
        invited.push(email);
        continue;
      }

      const subject = `Decision Required: ${articleId} - ${submission[0].title || "Manuscript"}`;
      const htmlContent = buildDecisionEmailHtml(submission[0], reviews[0].total);

      const apiInstance = new Brevo.TransactionalEmailsApi();
      apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

      await apiInstance.sendTransacEmail({
        sender: { email: process.env.BREVO_EMAIL, name: "ASFI Research Journal" },
        to: [{ email }],
        subject,
        htmlContent,
      });

      await saveEmailDetails(
        email,
        subject,
        htmlContent,
        invitedByEmail,
        articleId,
        [],
        [],
        [],
        "invite_editor_decision",
        "Delivered"
      );

      if (existing.length > 0) {
        await connection.execute(
          "UPDATE invitations SET decision_viewed = 0, invitation_status = 'pending' WHERE id = ?",
          [existing[0].id]
        );
      } else {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 14);
        await connection.execute(
          "INSERT INTO invitations (invitation_link, invited_user, invited_user_name, invitation_status, invitation_expiry_date, invited_for, decision_viewed) VALUES (?, ?, ?, 'pending', ?, 'To Decide', 0)",
          [articleId, email, editorNames.get(email) || email, expiryDate.toISOString().split("T")[0]]
        );
      }

      invited.push(email);
    }

    await connection.execute(
      "UPDATE submissions SET status = 'under_editor_decision' WHERE revision_id = ? AND status NOT IN ('accepted', 'rejected', 'published', 'returned_for_revision', 'returned_for_correction')",
      [articleId]
    );

    return {
      invited: invited.length > 0,
      editors: invited,
      message: `Responsible editor${invited.length > 1 ? "s" : ""} notified for decision`,
    };
  } catch (error) {
    console.error("Error notifying editor for decision:", error);
    return { invited: false, editors: [], message: "Failed to notify editor for decision" };
  } finally {
    if (connection) await connection.end();
  }
};

module.exports = { notifyEditorForDecision };
