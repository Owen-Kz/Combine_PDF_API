const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const dbPromise = require("../../routes/dbPromise.config");
const sendMail = require("../utils/nodeMailer");
const { LogAction } = require("../../Logger");

const loginSupport = async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ status: "error", message: "Email and password are required" });
        }
        const normalizedEmail = String(email).trim().toLowerCase();
        const [rows] = await dbPromise.query(
            "SELECT id, email, password_hash, fullname, role, is_active FROM support_team_credentials WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );
        if (rows.length === 0) {
            LogAction(`Support login failed: unknown email ${normalizedEmail}`, "WARN");
            return res.status(401).json({ status: "error", message: "Invalid email or password" });
        }
        const account = rows[0];
        if (account.is_active === 0 || account.is_active === "0") {
            return res.status(403).json({ status: "error", message: "This support account is disabled" });
        }
        const passwordOk = await bcrypt.compare(password, account.password_hash);
        if (!passwordOk) {
            LogAction(`Support login failed: invalid password for ${normalizedEmail}`, "WARN");
            return res.status(401).json({ status: "error", message: "Invalid email or password" });
        }
        await dbPromise.query("UPDATE support_team_credentials SET last_login_at = NOW(), reset_token = NULL, reset_token_expiry = NULL WHERE id = ?", [account.id]);
        const token = jwt.sign(
            { id: account.id, email: account.email, role: "support" },
            process.env.JWT_SECRET,
            { expiresIn: "12h" }
        );
        LogAction(`Support login success: ${normalizedEmail}`);
        return res.json({
            status: "success",
            token,
            user: { email: account.email, fullname: account.fullname, role: account.role },
        });
    } catch (error) {
        LogAction(`Support login error: ${error.message}`, "ERROR");
        return res.status(500).json({ status: "error", message: "Support login failed" });
    }
};

const requireSupportAuth = (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ status: "error", message: "Unauthorized" });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== "support") return res.status(403).json({ status: "error", message: "Forbidden" });
        req.supportUser = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ status: "error", message: "Invalid or expired token" });
    }
};

const RESET_CODE_TTL_MINUTES = 15;

const normalizeSupportEmail = (email) => String(email || "").trim().toLowerCase();

const hashCode = (code) =>
    crypto.createHash("sha256").update(String(code)).digest("hex");

const buildResetCodeEmail = (fullname, code, expiresInMinutes) => {
    const codeBlocks = code.split("").join(" ");
    return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Support Password Reset - ASFI Research Journal</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(to right, #250242, #550f4f); color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px 20px; background: #f9f9f9; }
            .code { display: inline-block; padding: 16px 32px; background: #ffffff; border: 2px solid #8a1e78; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 12px; color: #8a1e78; margin: 20px 0; font-family: monospace; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; border-top: 1px solid #eee; }
            .warning { background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 10px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Support Password Reset</h2>
          </div>
          <div class="content">
            <p>Dear ${fullname || "Support Team"},</p>
            <p>We received a request to reset the password for your ASFI Research Journal support account.</p>
            <div style="text-align: center;">
              <h3 class="code">${codeBlocks}</h3>
            </div>
            <p>Enter this code on the verification page to choose a new password.</p>
            <div class="warning">
              <p><strong>This code will expire in ${expiresInMinutes} minutes.</strong></p>
            </div>
            <p>If you did not request a password reset, please ignore this email or contact the system administrator.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ASFI Research Journal. All rights reserved.</p>
            <p style="font-size: 0.8em;">This is an automated message, please do not reply.</p>
          </div>
        </body>
        </html>
    `;
};

const buildPasswordChangedEmail = (fullname) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Support Password Changed - ASFI Research Journal</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(to right, #250242, #550f4f); color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px 20px; background: #f9f9f9; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>Password Changed</h2>
          </div>
          <div class="content">
            <p>Dear ${fullname || "Support Team"},</p>
            <p>Your support account password was recently changed.</p>
            <p>If you did not perform this action, please contact the system administrator immediately.</p>
            <p>You can now log in with your new password.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ASFI Research Journal. All rights reserved.</p>
          </div>
        </body>
        </html>
    `;
};

/**
 * Forgot password — generates a 6-digit verification code, stores its SHA-256
 * hash on the support account, and emails the code to the account email.
 * Always returns the same message whether or not the account exists (no user
 * enumeration).
 */
const forgotSupportPassword = async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ status: "error", message: "Email is required" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ status: "error", message: "Invalid email format" });
    }

    try {
        const normalizedEmail = normalizeSupportEmail(email);
        const [rows] = await dbPromise.query(
            "SELECT id, email, fullname, is_active, reset_token, reset_token_expiry FROM support_team_credentials WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );

        const alwaysResponse = {
            status: "success",
            message: "If an account exists with this email, a verification code has been sent.",
            expiresInMinutes: RESET_CODE_TTL_MINUTES,
        };

        if (rows.length === 0) {
            LogAction(`Support forgot-password requested for unknown email ${normalizedEmail}`, "WARN");
            return res.json(alwaysResponse);
        }

        const account = rows[0];
        if (account.is_active === 0 || account.is_active === "0") {
            LogAction(`Support forgot-password requested for disabled account ${normalizedEmail}`, "WARN");
            return res.json(alwaysResponse);
        }

        // Generate a fresh 6-digit code
        const code = crypto.randomInt(100000, 1000000).toString();
        const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);

        await dbPromise.query(
            "UPDATE support_team_credentials SET reset_token = ?, reset_token_expiry = ? WHERE id = ?",
            [hashCode(code), expiresAt, account.id]
        );

        // Send the code email. Failure logs via the shared mailer + error queue,
        // and is surfaced to the caller so they may retry.
        await sendMail({
            to: [{ email: account.email, name: account.fullname }],
            subject: "Support Password Reset Code - ASFI Research Journal",
            htmlContent: buildResetCodeEmail(account.fullname, code, RESET_CODE_TTL_MINUTES),
        }, { source: "support-forgot-password" });

        LogAction(`Support password reset code sent to ${normalizedEmail}`);
        return res.json(alwaysResponse);
    } catch (error) {
        LogAction(`Support forgot-password error: ${error.message}`, "ERROR");
        return res.status(500).json({
            status: "error",
            message: process.env.NODE_ENV === "development"
                ? error.message
                : "Failed to send password reset code. Please try again.",
        });
    }
};

/**
 * Verify the 6-digit reset code. No side effects — the code is only cleared
 * once the password is actually reset.
 */
const verifySupportResetCode = async (req, res) => {
    const { email, code } = req.body || {};
    if (!email || !code) {
        return res.status(400).json({ status: "error", message: "Email and verification code are required" });
    }

    try {
        const normalizedEmail = normalizeSupportEmail(email);
        const [rows] = await dbPromise.query(
            "SELECT id, email, reset_token, reset_token_expiry FROM support_team_credentials WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );

        if (rows.length === 0) {
            return res.status(400).json({ status: "error", message: "Invalid verification code" });
        }

        const account = rows[0];
        if (!account.reset_token || !account.reset_token_expiry) {
            return res.status(400).json({ status: "error", message: "No reset request found. Please request a new code." });
        }

        if (account.reset_token !== hashCode(code)) {
            return res.status(400).json({ status: "error", message: "Invalid verification code" });
        }

        if (new Date(account.reset_token_expiry) < new Date()) {
            return res.status(400).json({
                status: "error",
                message: "Verification code has expired. Please request a new one.",
                expired: true,
            });
        }

        return res.json({ status: "success", message: "Verification code is valid" });
    } catch (error) {
        LogAction(`Support verify-reset-code error: ${error.message}`, "ERROR");
        return res.status(500).json({ status: "error", message: "Failed to verify code. Please try again." });
    }
};

/**
 * Reset the support password — re-validates the code, then hashes and persists
 * the new password, clearing the reset code.
 */
const resetSupportPassword = async (req, res) => {
    const { email, code, password } = req.body || {};
    if (!email || !code || !password) {
        return res.status(400).json({ status: "error", message: "Email, verification code, and new password are required" });
    }

    if (password.length < 8) {
        return res.status(400).json({ status: "error", message: "Password must be at least 8 characters long" });
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        return res.status(400).json({
            status: "error",
            message: "Password must contain at least one uppercase letter, one lowercase letter, and one number",
        });
    }

    try {
        const normalizedEmail = normalizeSupportEmail(email);
        const [rows] = await dbPromise.query(
            "SELECT id, email, fullname, is_active, reset_token, reset_token_expiry FROM support_team_credentials WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );

        if (rows.length === 0) {
            return res.status(400).json({ status: "error", message: "Invalid verification code" });
        }

        const account = rows[0];
        if (!account.reset_token || !account.reset_token_expiry) {
            return res.status(400).json({ status: "error", message: "No reset request found. Please request a new code." });
        }

        if (account.reset_token !== hashCode(code)) {
            return res.status(400).json({ status: "error", message: "Invalid verification code" });
        }

        if (new Date(account.reset_token_expiry) < new Date()) {
            return res.status(400).json({
                status: "error",
                message: "Verification code has expired. Please request a new one.",
                expired: true,
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await dbPromise.query(
            "UPDATE support_team_credentials SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
            [hashedPassword, account.id]
        );

        // Confirmation email — isolated so a failure never fails the reset request.
        try {
            await sendMail({
                to: [{ email: account.email, name: account.fullname }],
                subject: "Support Password Changed - ASFI Research Journal",
                htmlContent: buildPasswordChangedEmail(account.fullname),
            }, { source: "support-password-changed" });
        } catch (emailError) {
            LogAction(`Support password-changed confirmation email failed: ${emailError.message}`, "ERROR");
        }

        LogAction(`Support password reset for ${normalizedEmail}`);
        return res.json({
            status: "success",
            message: "Password reset successfully! You can now log in with your new password.",
        });
    } catch (error) {
        LogAction(`Support reset-password error: ${error.message}`, "ERROR");
        return res.status(500).json({
            status: "error",
            message: process.env.NODE_ENV === "development"
                ? error.message
                : "Failed to reset password. Please try again.",
        });
    }
};

module.exports = { loginSupport, requireSupportAuth, forgotSupportPassword, verifySupportResetCode, resetSupportPassword };