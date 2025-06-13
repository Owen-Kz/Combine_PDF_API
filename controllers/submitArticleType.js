const db = require("../routes/db.config");
const generateArticleId = require("./generateArticleId");

const submitArticleType = async (req, res) => {
       if(!req.user || !req.user.id){
            return res.json({error:"Session is Not Valid, please login again"})
        }
    try {
        const correspondingAuthor = req.user.email; // Using authenticated user's email instead of cookie
        const { article_id, article_type, discipline, previous_manuscript_id, is_women_in_contemporary_science, submissionStatus } = req.body;
        // Validate required fields
        if (!article_type || !discipline || !submissionStatus) {
            return res.status(400).json({
                error: "All fields are required",
                received: { article_id, article_type, discipline, previous_manuscript_id, submissionStatus }
            });
        }

        // Get process type from session instead of cookie
        const process = req.manuscriptData?.process;
        let articleID = req.session.articleId;



        // Check if the ID already exists by another user's session
        db.query("SELECT * FROM submissions WHERE revision_id = ? AND corresponding_authors_email != ?", 
            [article_id, correspondingAuthor], 
            async (err, sessionId) => {
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({ error: "Database error" });
                }

                // if (sessionId[0]) {
                //     // Generate new ID if conflict exists
                //     articleID = await generateArticleId(req, res);
                //     req.session.articleId = articleID; // Store new ID in session
                // } else {
                //     articleID = req.manuscriptData?.sessionID || article_id;
                // }

                // Get counts from session instead of cookies
                let revisionsCount = req.manuscriptData?.newReviseCount || 0;
                let correctionsCount = req.manuscriptData?.newCorrectionCount || 0;

                // Check if submission already exists
                db.query("SELECT * FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ?", 
                    [articleID, correspondingAuthor], 
                    async (err, data) => {
                        if (err) {
                            console.error("Database error:", err);
                            return res.status(500).json({ error: "Database error" });
                        }

                        if (data[0]) {
                            // Update existing submission
                            db.query("UPDATE submissions SET article_type = ?, discipline = ?, previous_manuscript_id = ?, is_women_in_contemporary_science = ?, status = ? WHERE revision_id = ?", 
                                [article_type, discipline, previous_manuscript_id, is_women_in_contemporary_science, submissionStatus, articleID], 
                                (err, update) => {
                                    if (err) {
                                        console.error("Update error:", err);
                                        return res.status(500).json({ error: "Update failed" });
                                    }
                                    return res.json({ success: "Progress saved", uid:req.query._uid });
                                });
                        } else {
                            // Create new submission
                            db.query("INSERT INTO submissions SET ?", 
                                {
                                    article_id: article_id,
                                    revision_id: articleID,
                                    article_type: article_type,
                                    discipline: discipline,
                                    corresponding_authors_email: correspondingAuthor,
                                    is_women_in_contemporary_science: is_women_in_contemporary_science,
                                    status: submissionStatus,
                                    revisions_count: revisionsCount,
                                    corrections_count: correctionsCount
                                }, 
                                (err, insert) => {
                                    if (err) {
                                        console.error("Insert error:", err);
                                        return res.status(500).json({ error: "Insert failed" });
                                    }

                                    // Update counts for the article
                                    db.query("UPDATE submissions SET revisions_count = ?, corrections_count = ? WHERE article_id = ? AND revision_id != ?", 
                                        [revisionsCount, correctionsCount, article_id, articleID], 
                                        (err) => {
                                            if (err) {
                                                console.error("Count update error:", err);
                                                // Continue despite count update error
                                            }
                                        });

                                    return res.json({ success: "Progress has been saved", article_id:articleID });
                                });
                        }
                    });
            });
    } catch (error) {
        console.error("System error:", error);
        return res.status(500).json({ error: "System error" });
    }
};

module.exports = submitArticleType;
