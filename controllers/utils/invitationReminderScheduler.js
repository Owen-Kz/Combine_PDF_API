const dbPromise = require("../../routes/db.config");
const sendInvitationReminder = require("./sendInvitationReminder");

const REMINDER_WINDOWS = [
  { daysBefore: 3, reminderNumber: 1 },
  { daysBefore: 1, reminderNumber: 2 },
];

async function checkAndSendReminders() {
  try {
    const [invitations] = await dbPromise.promise().query(`
      SELECT 
        id, invited_user, invitation_link, invitation_expiry_date,
        invited_for, invitation_status, reminder_count
      FROM invitations
      WHERE invitation_status IN ('pending', 'invite_sent')
        AND invitation_expiry_date IS NOT NULL
        AND invitation_expiry_date >= CURDATE()
    `);

    if (invitations.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const inv of invitations) {
      const expiry = new Date(inv.invitation_expiry_date);
      expiry.setHours(0, 0, 0, 0);

      const diffMs = expiry.getTime() - today.getTime();
      const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      for (const window of REMINDER_WINDOWS) {
        if (daysUntilExpiry !== window.daysBefore) continue;
        if (inv.reminder_count >= window.reminderNumber) continue;

        const result = await sendInvitationReminder({
          recipientEmail: inv.invited_user,
          invitedFor: inv.invited_for,
          manuscriptId: inv.invitation_link,
          daysUntilExpiry,
          expiryDate: inv.invitation_expiry_date,
        });

        if (result.status === "success") {
          await dbPromise.promise().query(
            `UPDATE invitations 
             SET reminder_count = reminder_count + 1,
                 last_reminder_sent = ?
             WHERE id = ?`,
            [result.subject, inv.id]
          );
          console.log(
            `[Scheduler] Reminder #${window.reminderNumber} sent to ${inv.invited_user} for ${inv.invitation_link} (${daysUntilExpiry}d remaining)`
          );
        } else {
          console.error(
            `[Scheduler] Failed to send reminder to ${inv.invited_user}: ${result.message}`
          );
        }
      }
    }
  } catch (error) {
    console.error("[Scheduler] Error in invitation reminder scheduler:", error);
  }
}

function startInvitationReminderScheduler(intervalMs = 6 * 60 * 60 * 1000) {
  console.log("[Scheduler] Invitation reminder scheduler started (interval: " + (intervalMs / 3600000) + "h)");
  checkAndSendReminders();
  setInterval(checkAndSendReminders, intervalMs);
}

module.exports = { startInvitationReminderScheduler, checkAndSendReminders };
