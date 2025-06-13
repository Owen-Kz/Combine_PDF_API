const db = require("../routes/db.config");

const submitAbstract = async (req, res) => {
    try {
          if(!req.user || !req.user.id){
            return res.json({error:"Session is Not Valid, please login again"})
        }
        const correspondingAuthor = req.user.email; // Using authenticated user instead of cookie
        const { abstract } = req.body;

        // Validate required field
        if (!abstract || abstract.trim() === "") {
            return res.status(400).json({ 
                error: "Abstract is required",
                message: "Please provide the abstract content"
            });
        }

        const article_id = req.session.articleId;
        if (!article_id) {
            return res.status(400).json({ 
                error: "No active manuscript session",
                message: "Please start a new submission or reload your existing manuscript"
            });
        }

        // Check if manuscript exists
        db.query("SELECT * FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ?", 
            [article_id, correspondingAuthor], 
            async (err, data) => {
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({ 
                        error: "Database error",
                        message: "Failed to verify manuscript existence"
                    });
                }

                if (!data[0]) {
                    return res.status(404).json({ 
                        error: "Manuscript not found",
                        message: "The specified manuscript does not exist"
                    });
                }

                // Update abstract in database
                db.query("UPDATE submissions SET abstract = ? WHERE revision_id = ?", 
                    [abstract, article_id], 
                    (err, update) => {
                        if (err) {
                            console.error("Update error:", err);
                            return res.status(500).json({ 
                                error: "Update failed",
                                message: "Failed to save abstract to database"
                            });
                        }

                        if (update.affectedRows === 0) {
                            return res.status(404).json({ 
                                error: "No changes made",
                                message: "The manuscript was not updated"
                            });
                        }

                        // Store abstract in session
                        // req.session.manuscriptData = req.session.manuscriptData || {};
                        // req.session.manuscriptData.abstract = abstract;
                        
                        return res.json({ 
                            success: true,
                            message: "Abstract saved successfully"
                        });
                    });
            });
    } catch (error) {
        console.error("System error:", error);
        return res.status(500).json({ 
            error: "System error",
            message: "An unexpected error occurred"
        });
    }
};

module.exports = submitAbstract;