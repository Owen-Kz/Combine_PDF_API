// Shared SMTP mailer built on nodemailer.
// Replaces the previous Brevo transactional email integration.
const nodemailer = require("nodemailer");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

// Resolve the authenticated sender account. Supports both the
// NODE_MAILER_SENDER_EMAIL naming and the older NODE_MAILER_EMAIL one.
const getSenderEmail = () =>
    process.env.NODE_MAILER_SENDER_EMAIL || process.env.NODE_MAILER_EMAIL;
const getSenderPassword = () =>
    process.env.NODE_MAILER_SENDER_PASSWORD || process.env.NODE_MAILER_EMAIL_PASSWORD;

const createTransporter = () => {
    const host = process.env.SMTP_HOST || "server270.web-hosting.com";
    const port = parseInt(process.env.SMTP_PORT, 10) || 465;
    const secure = process.env.SMTP_SECURE === "false" ? false : true;
    const user = getSenderEmail();
    const pass = getSenderPassword();

    if (!user) throw new Error("NODE_MAILER_SENDER_EMAIL is not configured");
    if (!pass) throw new Error("NODE_MAILER_SENDER_PASSWORD is not configured");

    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
    });
};

// Convert a Brevo-style recipient list ([{email,name}]) into a nodemailer
// address string. Also accepts a single string or array of strings.
const buildAddressList = (entries) => {
    if (!entries) return undefined;
    const list = Array.isArray(entries) ? entries : [entries];
    return list
        .map((entry) => {
            if (typeof entry === "string") return entry.trim();
            if (entry && entry.email) {
                return entry.name ? `"${entry.name}" <${entry.email}>` : entry.email;
            }
            return null;
        })
        .filter(Boolean)
        .join(", ");
};

// Convert Brevo-style attachments into nodemailer attachments.
// Attachment entries may carry { content } (base64) or { url } which gets
// downloaded on the fly.
const buildAttachments = async (brevoAttachments) => {
    if (!Array.isArray(brevoAttachments) || brevoAttachments.length === 0) {
        return undefined;
    }
    const attachments = [];
    for (const att of brevoAttachments) {
        if (att.content) {
            attachments.push({
                filename: att.name,
                content: Buffer.from(att.content, "base64"),
                contentType: att.contentType || "application/octet-stream",
            });
        } else if (att.url) {
            try {
                const res = await axios({
                    method: "get",
                    url: att.url,
                    responseType: "arraybuffer",
                    timeout: 30000,
                    maxContentLength: 10 * 1024 * 1024,
                });
                attachments.push({
                    filename: att.name,
                    content: Buffer.from(res.data),
                    contentType: res.headers["content-type"] || "application/octet-stream",
                });
            } catch (err) {
                console.error(`Failed to download attachment ${att.name}:`, err.message);
            }
        }
    }
    return attachments.length > 0 ? attachments : undefined;
};

/**
 * Sends an email through SMTP using nodemailer.
 *
 * Accepts a Brevo-compatible payload so existing call sites only need to swap
 * the API client for this function.
 *
 * @param {Object} emailData
 * @param {{email: string, name: string}} [emailData.sender] Sender display info.
 * @param {Array} [emailData.to] Recipients as [{ email, name }] or strings.
 * @param {Array} [emailData.cc] CC recipients.
 * @param {Array} [emailData.bcc] BCC recipients.
 * @param {string} emailData.subject
 * @param {string} emailData.htmlContent
 * @param {Object} [emailData.headers] Extra email headers.
 * @param {Array} [emailData.attachment] Attachments as [{ content|url, name, contentType }].
 * @returns {Promise<{messageId: string}>}
 */
async function sendMail(emailData) {
    const senderEmail = getSenderEmail();
    const senderName =
        (emailData.sender && emailData.sender.name) || "ASFI Research Journal";

    const mailOptions = {
        from: `"${senderName}" <${senderEmail}>`,
        to: buildAddressList(emailData.to),
        subject: emailData.subject,
        html: emailData.htmlContent,
        headers: emailData.headers,
    };

    const cc = buildAddressList(emailData.cc);
    if (cc) mailOptions.cc = cc;

    const bcc = buildAddressList(emailData.bcc);
    if (bcc) mailOptions.bcc = bcc;

    const attachments = await buildAttachments(emailData.attachment);
    if (attachments) mailOptions.attachments = attachments;

    const transporter = createTransporter();
    const info = await transporter.sendMail(mailOptions);
    return { messageId: info.messageId };
}

module.exports = sendMail;