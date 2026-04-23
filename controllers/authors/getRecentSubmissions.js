// backend/controllers/author/getRecentSubmissions.js
const db = require("../../routes/db.config");
const dbPromise = require("../../routes/dbPromise.config");

const getRecentSubmissions = async (req, res) => {
    try {
        const userEmail = req.user.email; // From auth middleware
        
        if (!userEmail) {
            return res.status(400).json({ 
                status: "error", 
                message: "User email not found" 
            });
        }

        // Get recent submissions - INCLUDING DRAFTS
        const [submissions] = await db.promise().query(
            `SELECT revision_id as id, title, status, article_type as type, process_start_date as date, date_submitted
             FROM submissions 
             WHERE corresponding_authors_email = ? 
             ORDER BY 
                CASE 
                    WHEN status = 'draft' OR status = 'saved' OR status = 'drafted' THEN 1
                    ELSE 2
                END,
                id DESC 
             LIMIT 8`,
            [userEmail]
        );

        // Get keywords and authors for each submission
        const submissionsWithDetails = await Promise.all(
            submissions.map(async (submission) => {
                const [keywords] = await db.promise().query(
                    `SELECT keyword FROM submission_keywords 
                     WHERE article_id = ? 
                     ORDER BY id ASC`,
                    [submission.id]
                );
                
                const [authors] = await dbPromise.query(
                    `SELECT authors_fullname as name, authors_email as email 
                     FROM submission_authors 
                     WHERE submission_id = ?`,
                    [submission.id]
                );
                
                return {
                    ...submission,
                    keywords: keywords.map(k => k.keyword),
                    authors: authors
                };
            })
        );

        // Format dates
        const formattedSubmissions = submissionsWithDetails.map(sub => ({
            ...sub,
            date: sub.date_submitted ? new Date(sub.date_submitted).toLocaleDateString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).replace(/\//g, '-') : 'N/A',
            isDraft: sub.status === 'draft' || sub.status === 'saved' || sub.status === 'drafted'
        }));

        return res.json({
            status: "success",
            submissions: formattedSubmissions
        });

    } catch (error) {
        console.error("Error fetching recent submissions:", error);
        return res.status(500).json({ 
            status: "error", 
            message: "Internal server error" 
        });
    }
};

module.exports = getRecentSubmissions;