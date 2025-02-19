const db = require("../../../routes/db.config");


// API endpoint to get a list of editor emails
const listofEditorEmails = async (req, res) => {
    const editorId = req.user.email;  // Editor ID from session

    if (editorId) {
        try {
            // Find the editor details using the provided editor ID
            const [rows] = await db.promise().query("SELECT * FROM editors WHERE email = ?", [editorId]);

            if (rows.length > 0) {
                // Get list of emails of other editors
                const [emails] = await db.promise().query("SELECT email FROM editors WHERE email != ?", [editorId]);

                const listOfEmails = emails.map(emailRow => emailRow.email);

                // Respond with the list of emails
                return res.json({
                    success: "List of Emails",
                    emails: listOfEmails
                });
            } else {
                return res.status(404).json({ error: "Could Not Find Authors" });
            }
        } catch (err) {
            console.error("Error fetching editor emails:", err);
            return res.status(500).json({ error: "Database query failed" });
        }
    } else {
        return res.status(400).json({ error: "Invalid Editor ID" });
    }
}


module.exports = listofEditorEmails