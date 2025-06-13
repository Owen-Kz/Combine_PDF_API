const db = require("../routes/db.config");

const submitKeyword = async (req, res) => {
    try {
          if(!req.user || !req.user.id){
            return res.json({error:"Session is Not Valid, please login again"})
        }
        const correspondingAuthor = req.user.email; // Using authenticated user instead of cookie
        const { keyword } = req.body;
  

        // Validate keyword exists and is not empty
        if (!keyword || keyword.trim() === "") {
            return res.status(400).json({ error: "Keyword cannot be empty" });
        }

        const article_id = req.session.articleId;
        if (!article_id) {
            return res.status(400).json({ error: "No active manuscript session" });
        }

        // Check if keyword already exists for this article
        db.query("SELECT * FROM submission_keywords WHERE article_id = ? AND keyword = ?", 
            [article_id, keyword], 
            async (err, data) => {
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({ error: "Database error" });
                }

                if (data[0]) {
                    // Update existing keyword
                    db.query("UPDATE submission_keywords SET keyword = ? WHERE article_id = ? AND id = ?", 
                        [keyword, article_id, data[0].id], 
                        (err, update) => {
                            if (err) {
                                console.error("Update error:", err);
                                return res.status(500).json({ error: "Update failed" });
                            }
                            return res.json({ success: "Keyword updated successfully" });
                        });
                } else {
                    // Insert new keyword
                    db.query("INSERT INTO submission_keywords SET ?", 
                        { keyword: keyword, article_id: article_id }, 
                        (err, insert) => {
                            if (err) {
                                console.error("Insert error:", err);
                                return res.status(500).json({ error: "Insert failed" });
                            }
                            
                            // Update keyword count in session
                            const currentCount = req.session.manuscriptData?.KeyCount || 0;
                            req.session.manuscriptData.KeyCount = currentCount + 1;
                            
                            return res.json({ success: "Keyword added successfully" });
                        });
                }
            });
    } catch (error) {
        console.error("System error:", error);
        return res.status(500).json({ error: "System error" });
    }
};

module.exports = submitKeyword;