const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");


const allPreviousSubmissions = async (req, res) => {
    try {
        const adminId = req.user.id; // Extracting user ID from request
        const { item_id: revisionID } = req.body;
      
        if (await isAdminAccount(adminId)) {
            const query = `
                SELECT * 
                FROM submissions 
                WHERE (article_id = ? OR previous_manuscript_id = ?) AND title != '' AND title != 'Draft Submission' AND title IS NOT NULL 
                ORDER BY id DESC;
            `;

            db.query(query, [revisionID, revisionID], async (error, data) => {
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
