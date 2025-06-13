const db = require("../routes/db.config");
const checkIfFileExists = require("./fileUploads/checkIfExists");

const submitTitle = async (req, res) => {
    try {
          if(!req.user || !req.user.id){
            return res.json({error:"Session is Not Valid, please login again"})
        }
        const correspondingAuthor = req.user.email; // Using authenticated user instead of cookie
        const { manuscript_full_title } = req.body;

        // Validate required field
        if (!manuscript_full_title) {
            return res.status(400).json({ error: "Title is required" });
        }

        const article_id = req.session.articleId;
        if (!article_id) {
            return res.status(400).json({ error: "No active manuscript session" });
        }

        // Check if the manuscript exists
        db.query("SELECT * FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ?", 
            [article_id, correspondingAuthor], 
            async (err, data) => {
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({ error: "Database error" });
                }

                if (data[0]) {
                    // Check if files exist using session data
                    const manuscriptData = req.session.manuscriptData || {};
                    
                    // Check all file types
                    await Promise.all([
                        checkIfFileExists(req, res, manuscriptData.exist_man, "manuscript_file", manuscriptData.new_manuscript),
                        checkIfFileExists(req, res, manuscriptData.exist_cover, "cover_letter_File", manuscriptData.new_cover_letter),
                        checkIfFileExists(req, res, manuscriptData.exist_tables, "tables", manuscriptData.new_tables),
                        checkIfFileExists(req, res, manuscriptData.exist_figures, "figures", manuscriptData.new_figures),
                        checkIfFileExists(req, res, manuscriptData.exist_graphic, "graphic_abstract", manuscriptData.new_graphic_abstract),
                        checkIfFileExists(req, res, manuscriptData.exist_supplementary, "supplementary_material", manuscriptData.new_supplement),
                        checkIfFileExists(req, res, manuscriptData.exist_tracked, "tracked_manuscript_file", manuscriptData.new_tracked_file)
                    ]);

                    // Update the submission title
                    db.query("UPDATE submissions SET title = ? WHERE revision_id = ?", 
                        [manuscript_full_title, article_id], 
                        (err, update) => {
                            if (err) {
                                console.error("Update error:", err);
                                return res.status(500).json({ error: "Update failed" });
                            }
                            if (update.affectedRows > 0) {
                                return res.json({ success: "Progress saved", article_id });
                            }
                            return res.status(404).json({ error: "Manuscript not found" });
                        });
                } else {
                    return res.status(404).json({ error: "Manuscript does not exist" });
                }
            });
    } catch (error) {
        console.error("System error:", error);
        return res.status(500).json({ error: "System error" });
    }
};

module.exports = submitTitle;