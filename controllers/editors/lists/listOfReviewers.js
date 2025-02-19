const db = require("../../../routes/db.config");



// API endpoint to get list of reviewers available for review
const listOfREviewers =  async (req, res) => {
    const editorId = req.user.email;  // Editor ID from session

    if (editorId) {
        try {
            // Check if the editor exists
            const [editorRows] = await db.promise().query("SELECT * FROM editors WHERE email = ?", [editorId]);

            if (editorRows.length > 0) {
                // Find authors who are available for review
                const [authors] = await db.promise().query("SELECT * FROM authors_account WHERE is_available_for_review = 'yes'");

                if (authors.length > 0) {
                    const reviewersList = authors;  // List of authors who are available for review

                    return res.json({
                        message: "reviewersList",
                        reviewers: reviewersList
                    });
                } else {
                    return res.json({
                        message: "NO Reviewer available",
                        reviewers: []
                    });
                }
            } else {
                return res.status(403).json({
                    message: "unauthorized",
                    reviewers: []
                });
            }
        } catch (err) {
            console.error("Error fetching reviewers:", err);
            return res.status(500).json({
                message: "Database query failed",
                reviewers: []
            });
        }
    } else {
        return res.status(400).json({
            message: "Invalid session or editor ID",
            reviewers: []
        });
    }
}


module.exports = listOfREviewers;