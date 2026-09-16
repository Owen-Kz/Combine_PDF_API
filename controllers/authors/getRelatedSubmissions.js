// controllers/authors/getRelatedSubmissions.js
const db = require("../../routes/db.config");

const getRelatedSubmissions = async (req, res) => {
    try {
        const userEmail = req.user.email;
        const { id } = req.params;
        console.log(id)
        if (!userEmail || !id) {
            return res.status(400).json({ status: "error", message: "Invalid Parameters" });
        }

        const [OriginalSubmissionID] = await db.promise().query(
            "SELECT article_id FROM submissions WHERE revision_id = ? LIMIT 1",
            [id]
        );
        const originalArticleId = OriginalSubmissionID.length > 0 ? OriginalSubmissionID[0].article_id : null;

        // Resolve the base article_id for this submission
        const [articleResult] = await db.promise().query(
            "SELECT article_id FROM submissions WHERE previous_manuscript_id = ? OR article_id = ? LIMIT 1",
            [originalArticleId, originalArticleId]
        );
        if (articleResult.length === 0) {
            return res.json({ status: "success", submissions: [], message: "No submissions found" });
        }

        const articleId = articleResult[0].article_id;
        console.log("Base article_id for related submissions:", articleId);

        // Get all submissions owned by this author that belong to the same article family:
        // rows whose article_id matches the base id, or that were submitted against it.
        const [submissions] = await db.promise().query(
            `SELECT * FROM submissions
             WHERE corresponding_authors_email = ?
               AND (article_id = ? OR previous_manuscript_id = ?)
               AND title != ''
               AND title != 'Draft Submission'
          
             ORDER BY process_start_date ASC, id ASC`,
            [userEmail, articleId, articleId]
        );

        // Attach keywords and authors so each related submission can render in the modal
        const submissionsWithDetails = await Promise.all(
            submissions.map(async (submission) => {
                const key = submission.revision_id || submission.id;
                const [keywords] = await db.promise().query(
                    `SELECT keyword FROM submission_keywords 
                     WHERE article_id = ? 
                     ORDER BY id ASC`,
                    [key]
                );
                const [authors] = await db.promise().query(
                    `SELECT authors_fullname as name, authors_email as email 
                     FROM submission_authors 
                     WHERE submission_id = ?`,
                    [key]
                );
                return {
                    ...submission,
                    keywords: keywords.map(k => k.keyword),
                    authors_list: authors
                };
            })
        );

        return res.json({
            status: "success",
            submissions: submissionsWithDetails
        });

    } catch (error) {
        console.error("Error fetching related submissions:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
};

module.exports = getRelatedSubmissions;