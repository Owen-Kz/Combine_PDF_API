
const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");

const archiveSubmission = async (req, res) => {
    try {
        const { submissionId } = req.body;

        if (!submissionId) {
            return res.status(400).json({ error: "Submission ID is not set" });
        }

        // Fetch the `article_id` associated with the submission
        const fetchArticleQuery = "SELECT article_id FROM submissions WHERE revision_id = ?";
        db.query(fetchArticleQuery, [submissionId], async (error, results) => {
            if (error) {
                return res.status(500).json({ error: error.message });
            }
            
            if (results.length === 0) {
                return res.status(404).json({ error: "Submission ID not found" });
            }

            const mainArticleId = results[0].article_id;

            // Archive submission
            const archiveQuery = "INSERT INTO archived_submissions SELECT * FROM submissions WHERE article_id = ?";
            db.query(archiveQuery, [mainArticleId], async (error, archiveResults) => {
                if (error) {
                    console.log(error)
                    return res.status(500).json({ error: "Submission not archived" });
                }

                // Delete from submissions after archiving
                const deleteQuery = "DELETE FROM submissions WHERE article_id = ?";
                db.query(deleteQuery, [mainArticleId], (error, deleteResults) => {
                    if (error) {
                        return res.status(500).json({ error: error.message });
                    }

                    return res.json({ success: "Submission archived" });
                });
            });
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};

module.exports = archiveSubmission;
