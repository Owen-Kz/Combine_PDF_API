// emailErrorLogger.js
//
// Persists failed email sends into the `email_error_logs` table and drives the
// automatic retry pipeline:
//   - A failed send is stored with status 'pending' and next_retry_at = now + 15 min.
//   - Every 15 minutes the scheduler retries due emails.
//   - After 3 failed attempts the record is marked 'failed' (dead) and an alert
//     email is sent to the support team summarizing the failures.
//
// Loaded by nodeMailer.sendMail but never needed at module load, so this module
// does NOT require nodeMailer at the top (that would create a require cycle).
// Writes are defensive: a persistence failure never throws out of a caller.
const dbPromise = require("../../routes/dbPromise.config");
const { LogAction } = require("../../Logger");

const RETRY_DELAY_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@asfirj.org";

const getMailer = () => require("./nodeMailer");

// Extract every recipient email from a Brevo-style payload.
const extractRecipients = (emailData = {}) => {
    const out = [];
    for (const key of ["to", "cc", "bcc"]) {
        const entries = emailData[key];
        const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
        for (const entry of list) {
            const email = typeof entry === "string" ? entry : entry && entry.email;
            if (email && typeof email === "string" && email.includes("@") && !out.includes(email)) {
                out.push(email);
            }
        }
    }
    return out;
};

// Envelope/validation failures are permanent; transport/timeout failures are transient.
// Unknown errors default to transient (safe: they keep being retried).
const isPermanentFailure = (error = {}) => {
    const code = String(error.code || "");
    const message = String(error.message || "");
    if (
        /^(ECONNECTION|ECONNRESET|ECONNABORTED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|EDNS|PROTOCOL_CONNECTION_LOST)$/i.test(code) ||
        /greeting never received|data command failed|socket hang up|connect econn|\b4[0-9]{2}\b/.test(message)
    ) {
        return false;
    }
    if (code === "EENVELOPE") return true;
    return /no recipients defined|no valid recipients|invalid address|mailbox unavailable|\b5[0-9]{2}\b/i.test(message);
};

const nowPlusRetry = () => new Date(Date.now() + RETRY_DELAY_MS);

/**
 * Persist one failed email send.
 */
const logEmailError = async ({ emailData = {}, error = {}, source = "sendMail" }) => {
    try {
        const recipients = extractRecipients(emailData);
        const permanent = isPermanentFailure(typeof error === "object" ? error : { message: String(error) });
        const message = (error && error.message) || String(error);
        const code = (error && error.code) || null;

        await dbPromise.query(
            `INSERT INTO email_error_logs
                (recipient, subject, source, email_payload, error_message, error_code,
                 permanent_failure, attempts, max_attempts, status, next_retry_at,
                 first_failed_at, last_attempt_at, alert_sent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 0)`,
            [
                recipients[0] || null,
                emailData.subject || null,
                source,
                JSON.stringify(emailData),
                message,
                code,
                permanent ? 1 : 0,
                permanent ? MAX_ATTEMPTS : 1,
                MAX_ATTEMPTS,
                permanent ? "failed" : "pending",
                permanent ? null : nowPlusRetry(),
            ]
        );
    } catch (persistError) {
        LogAction(`[emailErrorLogger] Failed to persist email error: ${persistError.message}`, "ERROR");
    }
};

const getEmailErrorSummary = async () => {
    const empty = { total: 0, pending: 0, sent: 0, failed: 0, retried: 0, permanent_failures: 0 };
    try {
        const [rows] = await dbPromise.query(
            `SELECT status,
                    COUNT(*) AS total,
                    SUM(status = 'failed' AND permanent_failure = 1) AS permanent_failures
             FROM email_error_logs
             GROUP BY status`
        );
        for (const row of rows) {
            const key = String(row.status);
            if (Object.prototype.hasOwnProperty.call(empty, key)) {
                empty[key] = Number(row.total);
            }
            empty.total += Number(row.total);
            empty.permanent_failures += Number(row.permanent_failures || 0);
        }
        return empty;
    } catch (error) {
        LogAction(`[emailErrorLogger] getEmailErrorSummary error: ${error.message}`, "ERROR");
        return empty;
    }
};

const getEmailErrorLogs = async ({ status = null, limit = 50, offset = 0 } = {}) => {
    let rows = [];
    let total = 0;
    try {
        const where = status ? "WHERE status = ?" : "";
        const params = status ? [status, Number(limit), Number(offset)] : [Number(limit), Number(offset)];
        const [countRows] = await dbPromise.query(
            `SELECT COUNT(*) AS total FROM email_error_logs ${where}`,
            status ? [status] : []
        );
        total = Number(countRows[0] && countRows[0].total) || 0;
        const [result] = await dbPromise.query(
            `SELECT * FROM email_error_logs ${where} ORDER BY first_failed_at DESC, id DESC LIMIT ? OFFSET ?`,
            params
        );
        rows = result;
    } catch (error) {
        LogAction(`[emailErrorLogger] getEmailErrorLogs error: ${error.message}`, "ERROR");
    }
    return { rows, total };
};

// Resend a stored failed email and update its attempt counters.
// sendMail is called with { log: false } so a re-failure is persisted via the
// update below instead of inserting a brand-new row (no infinite growth).
const attemptResend = async (record) => {
    const nextAttempt = Number(record.attempts) + 1;
    let payload = {};
    try {
        payload = typeof record.email_payload === "string" ? JSON.parse(record.email_payload) : {};
    } catch (_) {
        payload = {};
    }

    try {
        const result = await getMailer()(payload, { log: false, source: record.source || "email-retry" });
        await dbPromise.query(
            `UPDATE email_error_logs
             SET status = 'sent', attempts = ?, last_error_message = NULL, resolved_at = NOW(), last_attempt_at = NOW(), next_retry_at = NULL
             WHERE id = ?`,
            [nextAttempt, record.id]
        );
        LogAction(`[email-retry] Email ${record.id} resent successfully (attempt ${nextAttempt}) to ${record.recipient}`);
        return { id: record.id, status: "sent", queued: false, messageId: result.messageId };
    } catch (error) {
        const permanent = isPermanentFailure(error);
        const dead = nextAttempt >= MAX_ATTEMPTS;
        const newStatus = dead ? "failed" : "pending";
        if (dead) {
            await dbPromise.query(
                `UPDATE email_error_logs
                 SET status = ?, attempts = ?, permanent_failure = ?, last_error_message = ?, error_message = ?, error_code = ?, next_retry_at = NULL, alert_sent = 0, last_attempt_at = NOW()
                 WHERE id = ?`,
                [newStatus, nextAttempt, permanent ? 1 : 0, error.message, error.message, error.code || null, record.id]
            );
        } else {
            await dbPromise.query(
                `UPDATE email_error_logs
                 SET status = 'pending', attempts = ?, permanent_failure = ?, last_error_message = ?, error_message = ?, error_code = ?, next_retry_at = ?, alert_sent = 0, last_attempt_at = NOW()
                 WHERE id = ?`,
                [nextAttempt, permanent ? 1 : 0, error.message, error.message, error.code || null, nowPlusRetry(), record.id]
            );
        }
        LogAction(`[email-retry] Retry ${nextAttempt} for email ${record.id} failed: ${error.message}`, "ERROR");
        return { id: record.id, status: newStatus, attempts: nextAttempt };
    }
};

let retryRunning = false;

const processRetryQueue = async () => {
    if (retryRunning) return { skipped: true };
    retryRunning = true;
    const result = { attempted: 0, sent: 0, stillPending: 0, dead: 0 };
    try {
        const [due] = await dbPromise.query(
            `SELECT * FROM email_error_logs
             WHERE status IN ('pending', 'retried')
               AND attempts < max_attempts
               AND (next_retry_at IS NULL OR next_retry_at <= NOW())
             ORDER BY first_failed_at ASC
             LIMIT 50`
        );

        for (const record of due) {
            result.attempted += 1;
            const outcome = await attemptResend(record);
            if (outcome.status === "sent") result.sent += 1;
            else if (outcome.status === "failed") result.dead += 1;
            else result.stillPending += 1;
        }
    } catch (error) {
        LogAction(`[email-retry] processRetryQueue error: ${error.message}`, "ERROR");
    } finally {
        retryRunning = false;
    }

    if (result.dead > 0 || result.attempted > 0) {
        await alertSupportIfNeeded();
    }
    return result;
};

const startEmailRetryScheduler = (intervalMs = RETRY_DELAY_MS) => {
    if (startEmailRetryScheduler.started) return;
    startEmailRetryScheduler.started = true;
    LogAction(`[email-retry] Scheduler starting (interval ${intervalMs}ms)`);
    setTimeout(() => {
        processRetryQueue().catch(() => {});
    }, 30 * 1000);
    setInterval(() => {
        processRetryQueue().catch(() => {});
    }, intervalMs);
};

const manualRetryEmail = async (id) => {
    const [rows] = await dbPromise.query("SELECT * FROM email_error_logs WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) return { found: false };
    const record = rows[0];
    if (record.status === "sent") return { found: true, status: "sent", message: "This email was already sent successfully." };
    const outcome = await attemptResend(record);
    if (outcome.status !== "sent") {
        // Operator already sees the failure in the dashboard — avoid a duplicate
        // automated support alert email for this record.
        await dbPromise.query("UPDATE email_error_logs SET alert_sent = 1 WHERE id = ?", [id]);
    }
    await alertSupportIfNeeded();
    return { found: true, ...outcome };
};

const manualRetryAll = async () => {
    const [retryable] = await dbPromise.query(
        `SELECT * FROM email_error_logs
         WHERE (status IN ('pending', 'retried') OR (status = 'failed' AND attempts < max_attempts))
         ORDER BY first_failed_at ASC
         LIMIT 100`
    );
    const result = { attempted: 0, sent: 0, stillPending: 0, dead: 0 };
    for (const record of retryable) {
        result.attempted += 1;
        const outcome = await attemptResend(record);
        if (outcome.status === "sent") result.sent += 1;
        else if (outcome.status === "failed") result.dead += 1;
        else result.stillPending += 1;
    }
    await alertSupportIfNeeded();
    return result;
};

// Send ONE summary alert email to support when emails have permanently failed.
// Uses { log: false } so the alert itself is never re-queued. If SMTP is down
// the alert failure is only logged, not persisted/crashed.
const alertSupportIfNeeded = async () => {
    try {
        const [failed] = await dbPromise.query(
            `SELECT id, recipient, subject, attempts, max_attempts
             FROM email_error_logs
             WHERE status = 'failed' AND alert_sent = 0
             ORDER BY first_failed_at DESC
             LIMIT 20`
        );
        if (failed.length === 0) return;

        const rowsHtml = failed
            .map(
                (r) =>
                    `<tr>
                        <td style="border:1px solid #ddd;padding:8px;">${r.recipient || "-"}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${(r.subject || "No subject").slice(0, 80)}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${r.attempts}/${r.max_attempts}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${r.status}</td>
                     </tr>`
            )
            .join("");

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>ASFIRJ Email Alert</title></head>
        <body style="font-family:Arial,sans-serif;color:#333;padding:20px;">
            <h2 style="color:#9e0f8b;">ASFIRJ Email Delivery Alert</h2>
            <p>One or more automated emails have permanently failed to send after ${MAX_ATTEMPTS} attempts and need manual attention.</p>
            <table style="border-collapse:collapse;width:100%;">
                <tr>
                    <th style="border:1px solid #ddd;padding:8px;text-align:left;">Recipient</th>
                    <th style="border:1px solid #ddd;padding:8px;text-align:left;">Subject</th>
                    <th style="border:1px solid #ddd;padding:8px;text-align:left;">Attempts</th>
                    <th style="border:1px solid #ddd;padding:8px;text-align:left;">Status</th>
                </tr>
                ${rowsHtml}
            </table>
            <p style="margin-top:16px;">Please review the failed emails in the Support Dashboard and retry or resolve them.</p>
        </body>
        </html>`;

        await getMailer()(
            {
                to: [{ email: SUPPORT_EMAIL }],
                subject: `[ASFIRJ Support] ${failed.length} email(s) failed permanently`,
                htmlContent,
            },
            { log: false, source: "support-alert" }
        );

        await dbPromise.query(
            `UPDATE email_error_logs SET alert_sent = 1 WHERE id IN (?)`,
            [failed.map((r) => r.id)]
        );
        LogAction(`[email-retry] Support alert sent for ${failed.length} permanently failed email(s)`);
    } catch (error) {
        LogAction(`[email-retry] Support alert could not be sent: ${error.message}`, "ERROR");
    }
};

module.exports = {
    RETRY_DELAY_MS,
    MAX_ATTEMPTS,
    SUPPORT_EMAIL,
    logEmailError,
    processRetryQueue,
    startEmailRetryScheduler,
    manualRetryEmail,
    manualRetryAll,
    getEmailErrorLogs,
    getEmailErrorSummary,
};