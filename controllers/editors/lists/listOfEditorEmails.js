// controllers/account/invitations/listOfEditorEmails.js
const db = require("../../../routes/db.config");

const listOfEditorEmails = async (req, res) => {
    const editorId = req.user.email;
    const { articleId } = req.body;

    if (!editorId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    if (!articleId) {
        return res.status(400).json({ error: "Article ID is required" });
    }

    try {
        // First, get all authors of this submission to exclude them
        const [submissionAuthors] = await db.promise().query(
            "SELECT authors_email FROM submission_authors WHERE submission_id = ?",
            [articleId]
        );

        const authorEmails = submissionAuthors.map(author => author.authors_email);

        // Get list of emails of other editors, excluding the current editor and submission authors
        const [emails] = await db.promise().query(
            `SELECT email FROM editors 
             WHERE email != ? 
             AND email NOT IN (?)`,
            [editorId, authorEmails.length > 0 ? authorEmails : ['']]
        );

        const listOfEmails = emails.map(emailRow => emailRow.email);

        return res.json({
            success: "List of Emails",
            emails: listOfEmails
        });
    } catch (err) {
        console.error("Error fetching editor emails:", err);
        return res.status(500).json({ error: "Database query failed" });
    }
};

module.exports = listOfEditorEmails;