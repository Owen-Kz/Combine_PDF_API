const db = require("../../routes/db.config");
const dbPromise = require("../../routes/dbPromise.config");
const isAdminAccount = require("./isAdminAccount");


const allPreviousSubmissions = async (req, res) => {
    try {
        const adminId = req.user.id; // Extracting user ID from request
        const { item_id: revisionID } = req.body;
      
        if (await isAdminAccount(adminId)) {
            const [getPreviousManuscirptQuery] = await dbPromise.query("SELECT previous_manuscript_id, article_id FROM submissions WHERE revision_id = ?", [revisionID]);
            const previousManuscriptId = getPreviousManuscirptQuery[0]?.previous_manuscript_id || null;
            const articleId = getPreviousManuscirptQuery[0]?.article_id || null;

            console.log("Previous Manuscript ID:", previousManuscriptId);
    
            if (!articleId) {
                return res.status(400).json({ error: "Invalid revision_id or no previous manuscript found." });
            }
            const query = `
                SELECT * 
                FROM submissions 
                WHERE (article_id = ? OR revision_id = ? OR article_id = ?) AND title != '' AND title != 'Draft Submission' AND title IS NOT NULL 
                ORDER BY id DESC;
            `;

            db.query(query, [articleId, previousManuscriptId, previousManuscriptId], async (error, data) => {
                if (error) {
                    return res.status(500).json({ error: error.message });
                }
          

                if (data.length > 0) {
                    // Ensure all values are encoded properly
                    // const formattedData = data.map(row => {
                    //     Object.keys(row).forEach(key => {
                    //         row[key] = row[key] !== null ? Buffer.from(row[key]).toString('utf-8') : '';
                    //     });
                    //     return row;
                    // });

                    return res.json({ success: "Admin Account", submissions: data});
                } else {
                    return res.json({ success: "Admin Account", submissions: [] });
                }
            });
        } else {
            return res.status(403).json({ error: "Not Admin Account" });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};

module.exports = allPreviousSubmissions;
