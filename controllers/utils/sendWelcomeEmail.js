const { sendEmail } = require("./sendEmail");

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function wrapTemplate(bodyContent) {
    const year = new Date().getFullYear();
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ASFI Research Journal</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(to right, #250242, #550f4f); color: #ffffff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 30px; background: #8a1e78; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .button:hover { background: #6a175e; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; border-top: 1px solid #eee; }
        a { color: #8a1e78; }
    </style>
</head>
<body>
    <div class="header">
        <h2>ASFI Research Journal</h2>
    </div>
    <div class="content">
        ${bodyContent}
    </div>
    <div class="footer">
        <p>&copy; ${year} ASFI Research Journal. All rights reserved.</p>
        <p style="font-size: 0.8em;">This is an automated message, please do not reply.</p>
    </div>
</body>
</html>`;
}

async function sendAuthorWelcomeEmail({ email, firstName, lastName }) {
    const body = `
        <p>Dear ${escapeHtml(firstName)} ${escapeHtml(lastName)},</p>
        <p>Welcome to ASFI Research Journal!</p>
        <p>Your email has been verified successfully. You can now log in and:</p>
        <ul>
            <li>Submit your manuscripts for publication</li>
            <li>Track the status of your submissions</li>
            <li>Collaborate with co-authors</li>
            <li>Access your reviewer dashboard (if invited)</li>
        </ul>
        <div style="text-align: center;">
            <a href="https://asfirj.org/portal/login/" class="button" style="color:#fff;">Log In to Your Account</a>
        </div>
        <p>If you have any questions, please contact our support team at <a href="mailto:support@asfirj.org">support@asfirj.org</a>.</p>
        <p>Best regards,<br>The ASFIRJ Team</p>
    `;

    return sendEmail({
        to: email,
        subject: "Welcome to ASFI Research Journal – Email Verified",
        htmlContent: wrapTemplate(body),
        fromName: "ASFI Research Journal"
    });
}

async function sendReviewerWelcomeEmail({ email, firstName, lastName }) {
    const body = `
        <p>Dear ${escapeHtml(firstName)} ${escapeHtml(lastName)},</p>
        <p>Thank you for accepting the invitation to serve as a reviewer for ASFI Research Journal.</p>
        <p>Your contribution helps us maintain the highest standards of academic publishing. You can now:</p>
        <ul>
            <li>Access assigned manuscripts in your reviewer dashboard</li>
            <li>Submit your review reports</li>
            <li>Track the status of your reviews</li>
        </ul>
        <div style="text-align: center;">
            <a href="https://asfirj.org/portal/reviewer/dashboard/" class="button" style="color:#fff;">Go to Reviewer Dashboard</a>
        </div>
        <p>If you have any questions about the review process, please contact <a href="mailto:editorial@asfirj.org">editorial@asfirj.org</a>.</p>
        <p>Best regards,<br>The ASFIRJ Editorial Team</p>
    `;

    return sendEmail({
        to: email,
        subject: "Review Invitation Accepted – ASFI Research Journal",
        htmlContent: wrapTemplate(body),
        fromName: "ASFI Research Journal"
    });
}

async function sendEditorWelcomeEmail({ email, firstName, lastName }) {
    const body = `
        <p>Dear ${escapeHtml(firstName)} ${escapeHtml(lastName)},</p>
        <p>Welcome to the ASFI Research Journal editorial team!</p>
        <p>Your editor invitation has been accepted successfully. As an editor, you can now:</p>
        <ul>
            <li>Manage assigned manuscripts in your editorial dashboard</li>
            <li>Invite reviewers and track the review process</li>
            <li>Make editorial decisions on submissions</li>
            <li>Communicate with authors and reviewers</li>
        </ul>
        <div style="text-align: center;">
            <a href="https://asfirj.org/portal/editor/dashboard/" class="button" style="color:#fff;">Go to Editorial Dashboard</a>
        </div>
        <p>If you need assistance, please reach out to <a href="mailto:editorial@asfirj.org">editorial@asfirj.org</a>.</p>
        <p>Best regards,<br>The ASFIRJ Editorial Team</p>
    `;

    return sendEmail({
        to: email,
        subject: "Editor Invitation Accepted – Welcome to the ASFIRJ Team",
        htmlContent: wrapTemplate(body),
        fromName: "ASFI Research Journal"
    });
}

module.exports = {
    sendAuthorWelcomeEmail,
    sendReviewerWelcomeEmail,
    sendEditorWelcomeEmail
};
