const sendMail = require("./nodeMailer");
const { escapeHtml } = require("./security");

const sendInvitationReminder = async ({ recipientEmail, invitedFor, manuscriptId, daysUntilExpiry, expiryDate, customMessage, baseUrl }) => {
  try {
    const currentYear = new Date().getFullYear();
    const roleLabel = invitedFor === "Submission Review" ? "reviewer" : "editor";
    const actionLabel = invitedFor === "Submission Review" ? "review" : "edit";
    const frontendUrl = baseUrl || process.env.FRONTEND_URL || "https://asfirj.org";
    const expiryFormatted = new Date(expiryDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const actionType = invitedFor === "Submission Review" ? "reviewer" : "editor";
    const emailEncoded = encodeURIComponent(recipientEmail);
    const token = `invite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const isReviewer = roleLabel === "reviewer" ? true : false
    const role = isReviewer ? 'reviewer' : 'editor';
    const email = encodeURIComponent(formData.reviewerEmail);
    const redirectPath = isReviewer ? `reviewerdash/review/${manuscriptId}` : null;

    const params = new URLSearchParams({
      type: role,
      id: manuscriptId,
      email, // already encoded; URLSearchParams will double-encode if you pass the raw value, see note below
      token,
      ...(redirectPath ? { url: redirectPath } : {}),
    });

    const acceptLink = `${frontendUrl}/invitation/accept?${params.toString()}`;
    // const acceptLink = `${frontendUrl}/invitation/accept?type=${actionType}&id=${manuscriptId}&email=${emailEncoded}&token=${token}`;
    const declineLink = `${frontendUrl}/invitation/decline?type=${actionType}&id=${manuscriptId}&email=${emailEncoded}&token=${token}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitation Reminder</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 20px; }
        .deadline { font-weight: bold; color: #c0392b; }
        .button { background-color: #9e0f8b; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 15px 0; }
        .decline { color: #c0392b; }
        .note { background: #fff8e1; border: 1px solid #ffecb3; border-left: 4px solid #f9a825; padding: 12px 15px; margin: 15px 0; border-radius: 4px; color: #5d4037; }
        .footer { font-size: 0.8em; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h2>Invitation Reminder</h2>
    </div>

    <p>Dear ${roleLabel},</p>

    <p>This is a reminder that you have a pending invitation to ${actionLabel} manuscript <strong>${manuscriptId}</strong> for the ASFI Research Journal.</p>

    <p>Your invitation expires on <span class="deadline">${expiryFormatted}</span>. You have <strong>${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}</strong> remaining to respond.</p>

    ${customMessage ? `<div class="note"><strong>Message from the editor:</strong><br>${escapeHtml(customMessage)}</div>` : ""}

    <div style="text-align: center;">
        <a href="${acceptLink}" class="button">Accept Invitation</a>
    </div>

    <p style="text-align: center; margin: 5px 0 20px;">
        <a href="${declineLink}" class="decline">Decline Invitation</a>
    </p>

    <p>If you are unable to take on this ${actionLabel}, please decline the invitation so that we may assign another ${roleLabel}.</p>

    <div class="footer">
        <p>ASFI Research Journal &copy; ${currentYear}</p>
        <p style="font-size: 0.8em;">
            <a href="${frontendUrl}/unsubscribe?email=${encodeURIComponent(recipientEmail)}">Unsubscribe</a> |
            <a href="${frontendUrl}/contact">Contact Us</a>
        </p>
    </div>
</body>
</html>`;

    const subject = `Reminder: Pending ${invitedFor === "Submission Review" ? "Review" : "Editorial"} Invitation - ${manuscriptId}`;

    const emailData = {
      sender: {
        email: process.env.NODE_MAILER_SENDER_EMAIL || process.env.NODE_MAILER_EMAIL,
        name: "ASFI Research Journal",
      },
      to: [{ email: recipientEmail }],
      subject: subject,
      htmlContent: htmlContent,
      headers: {
        "List-Unsubscribe": `<${frontendUrl}/unsubscribe?email=${encodeURIComponent(recipientEmail)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };

    await sendMail(emailData);
    return { status: "success", subject, htmlContent };
  } catch (error) {
    console.error("Error sending invitation reminder:", error);
    return { status: "error", message: error.message };
  }
};

module.exports = sendInvitationReminder;