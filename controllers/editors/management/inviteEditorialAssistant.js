// controllers/editors/management/inviteEditorialAssistant.js
// Invites a person by email to become an editorial_assistant. Stores a
// self-contained invitation in the invitations table (invitation_link holds a
// generated token, invited_for discriminates the editorial-assistant flow)
// and emails them a branded accept link.
const crypto = require("crypto");
const dbPromise = require("../../../routes/dbPromise.config");
const { sendEmail, escapeHtml } = require("../../utils/sendEmail");

const INVITE_TOKEN_DAYS_VALID = 14;
const INVITED_FOR = "editorial_assistant";

const inviteEditorialAssistant = async (req, res) => {
  try {
    const { email, fullname } = req.body;

    if (!email) {
      return res.status(400).json({ status: "error", message: "Email is required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ status: "error", message: "Invalid email format" });
    }

    const invitedEmail = email.trim().toLowerCase();

    // Refuse if this email is already an editor.
    const [existingEditor] = await dbPromise.query(
      "SELECT id, editorial_level FROM editors WHERE email = ?",
      [invitedEmail]
    );

    if (existingEditor.length > 0) {
      return res.status(409).json({
        status: "error",
        message: "This email is already registered as an editor"
      });
    }

    // Refuse if a pending editorial-assistant invitation already exists.
    const [existingInvite] = await dbPromise.query(
      `SELECT id FROM invitations
       WHERE invited_user = ? AND invited_for = ?
         AND (invitation_status = 'invite_sent' OR invitation_status = 'pending')`,
      [invitedEmail, INVITED_FOR]
    );

    if (existingInvite.length > 0) {
      return res.status(200).json({
        status: "warning",
        message: `An invitation has already been sent to ${invitedEmail}`
      });
    }

    const token = crypto.randomBytes(24).toString("hex");

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + INVITE_TOKEN_DAYS_VALID);

    const inviter = req.user ? `${req.user.fullname} (${req.user.email})` : "the editorial office";

    await dbPromise.query(
      `INSERT INTO invitations
        (invitation_link, invited_user, invited_user_name, invitation_status,
         invitation_expiry_date, invited_for)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        token,
        invitedEmail,
        fullname ? fullname.trim() : "",
        "invite_sent",
        expiryDate.toISOString().split("T")[0],
        INVITED_FOR
      ]
    );

    const acceptLink = `${process.env.FRONTEND_URL || "https://asfirj.org"}/invitation/editorial-assistant/accept?email=${encodeURIComponent(
      invitedEmail
    )}&token=${token}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Editorial Assistant Invitation - ASFI Research Journal</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(to right, #250242, #550f4f); color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 30px 20px; background: #f9f9f9; }
    .button { display: inline-block; padding: 12px 30px; background: #8a1e78; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; border-top: 1px solid #eee; }
    a { color: #8a1e78; }
  </style>
</head>
<body>
  <div class="header"><h2>ASFI Research Journal</h2></div>
  <div class="content">
    <p>Dear ${escapeHtml(fullname || invitedEmail)},</p>
    <p>You have been invited to join the editorial team of ASFI Research Journal as an <strong>Editorial Assistant</strong>.</p>
    <p>As an Editorial Assistant you will be able to manage submissions and assist the editorial office in processing manuscripts.</p>
    <div style="text-align: center;">
      <a href="${acceptLink}" class="button" style="color:#fff;">Accept Invitation</a>
    </div>
    <p>This invitation link will expire in ${INVITE_TOKEN_DAYS_VALID} days. If the button does not work, copy and paste this link into your browser:</p>
    <p style="word-break: break-all; font-size: 0.9em;">${acceptLink}</p>
    <p style="color:#888; font-size:0.85em;">If you did not expect this invitation, you can ignore this email.</p>
  </div>
  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} ASFI Research Journal. All rights reserved.</p>
    <p>Invitation sent by ${escapeHtml(inviter)}.</p>
  </div>
</body>
</html>
`;

    const result = await sendEmail({
      to: invitedEmail,
      subject: "Invitation to Join the Editorial Team – ASFI Research Journal",
      htmlContent,
      fromName: "ASFI Research Journal"
    });

    if (result.status !== "success") {
      await dbPromise.query(
        "DELETE FROM invitations WHERE invitation_link = ? AND invited_user = ? AND invited_for = ?",
        [token, invitedEmail, INVITED_FOR]
      );
      console.error("Invitation email failed:", result);
      return res.status(500).json({
        status: "error",
        message: result.message || "Could not send invitation email"
      });
    }

    return res.json({
      status: "success",
      message: `Editorial assistant invitation sent to ${invitedEmail}`,
      data: {
        email: invitedEmail,
        expiryDate: expiryDate.toISOString()
      }
    });
  } catch (error) {
    console.error("Error inviting editorial assistant:", error);
    return res.status(500).json({
      status: "error",
      message: process.env.NODE_ENV === "development" ? error.message : "Failed to send invitation"
    });
  }
};

module.exports = inviteEditorialAssistant;