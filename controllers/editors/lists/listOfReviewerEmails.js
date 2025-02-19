const db = require("../../../routes/db.config");


// API endpoint to get a list of emails for authors available for review
const listOfReviewerEmails =  async (req, res) => {
    const editorId = req.user.email;  // Editor ID from session

    if (editorId) {
        try {
            // Find the editor details using the provided editor ID
            const [editorRows] = await db.promise().query("SELECT * FROM editors WHERE email = ?", [editorId]);

            if (editorRows.length > 0) {
                // Find authors who are available for review
                const [authors] = await db.promise().query("SELECT email FROM authors_account WHERE is_available_for_review = 'yes'");

                const listOfEmails = authors.map(authorRow => authorRow.email);

                // Respond with the list of emails
                return res.json({
                    success: "List of Emails",
                    emails: listOfEmails
                });
            } else {
                return res.status(404).json({ error: "Could Not Find Authors" });
            }
        } catch (err) {
            console.error("Error fetching author emails:", err);
            return res.status(500).json({ error: "Database query failed" });
        }
    } else {
        return res.status(400).json({ error: "Invalid Editor ID" });
    }
}

module.exports = listOfReviewerEmails
