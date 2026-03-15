// controllers/account/invitations/listOfReviewerEmails.js
const db = require("../../../routes/db.config");

const listOfReviewerEmails = async (req, res) => {
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

        // Find authors who are available for review and not in the submission authors
        const [authors] = await db.promise().query(
            `SELECT email FROM authors_account 
             WHERE is_available_for_review = 'yes' 
             AND email NOT IN (?)`,
            [authorEmails.length > 0 ? authorEmails : ['']]
        );

        const listOfEmails = authors.map(authorRow => authorRow.email);

        return res.json({
            success: "List of Emails",
            emails: listOfEmails
        });
    } catch (err) {
        console.error("Error fetching reviewer emails:", err);
        return res.status(500).json({ error: "Database query failed" });
    }
};

module.exports = listOfReviewerEmails;