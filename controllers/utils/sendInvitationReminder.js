const Brevo = require("@getbrevo/brevo");

const sendInvitationReminder = async ({ recipientEmail, invitedFor, manuscriptId, daysUntilExpiry, expiryDate }) => {
  try {
    const apiInstance = new Brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      Brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );

    const currentYear = new Date().getFullYear();
    const roleLabel = invitedFor === "Submission Review" ? "reviewer" : "editor";
    const actionLabel = invitedFor === "Submission Review" ? "review" : "edit";
    const portalUrl = "https://asfirj.org/portal";
    const expiryFormatted = new Date(expiryDate).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

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

    <p>Please log in to your dashboard to accept or decline this invitation:</p>

    <a href="${portalUrl}" class="button">View Invitation</a>

    <p>If you are unable to take on this ${actionLabel}, please decline the invitation so that we may assign another ${roleLabel}.</p>

    <div class="footer">
        <p>ASFI Research Journal &copy; ${currentYear}</p>
        <p style="font-size: 0.8em;">
            <a href="https://asfirj.org/unsubscribe?email=${encodeURIComponent(recipientEmail)}">Unsubscribe</a> |
            <a href="https://asfirj.org/contact">Contact Us</a>
        </p>
    </div>
</body>
</html>`;

    const subject = `Reminder: Pending ${invitedFor === "Submission Review" ? "Review" : "Editorial"} Invitation - ${manuscriptId}`;

    const emailData = {
      sender: {
        email: process.env.BREVO_EMAIL,
        name: "ASFI Research Journal",
      },
      to: [{ email: recipientEmail }],
      subject: subject,
      htmlContent: htmlContent,
      headers: {
        "List-Unsubscribe": `<https://asfirj.org/unsubscribe?email=${encodeURIComponent(recipientEmail)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };

    await apiInstance.sendTransacEmail(emailData);
    return { status: "success", subject };
  } catch (error) {
    console.error("Error sending invitation reminder:", error);
    return { status: "error", message: error.message };
  }
};

module.exports = sendInvitationReminder;
