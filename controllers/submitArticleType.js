const db = require("../routes/db.config");
const dbPromise = require("../routes/dbPromise.config");
const generateArticleId = require("./generateArticleId");

// Retry function with exponential backoff (consistent with upload handler)
async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            console.log(`Operation attempt ${attempt}/${maxRetries} failed:`, error.message);
            
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                const jitter = delay * 0.1 * (Math.random() * 2 - 1);
                const totalDelay = Math.max(100, delay + jitter);
                
                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
        }
    }
    
    throw lastError;
}

const submitArticleType = async (req, res) => {
    if (!req.user || !req.user.id) {
        return res.json({ error: "Session is Not Valid, please login again" });
    }
    
    try {
        const correspondingAuthor = req.user.email;
        const { article_type, discipline, previous_manuscript_id, is_women_in_contemporary_science, submissionStatus } = req.body;
        
        // Validate required fields
        if (!article_type || !discipline || !submissionStatus) {
            return res.status(400).json({
                error: "All fields are required",
                received: { article_type, discipline, submissionStatus }
            });
        }

        // Get process type and article ID from session
        const process = req.session.manuscriptData?.process || "new";
        let articleID = req.session.articleId;
        let newRevisionID = req.session.manuscriptData?.new_revisionID;
        
        // Use the new revision ID if it exists (for revisions/corrections)
        if (newRevisionID) {
            articleID = newRevisionID;
        }

        // Extract base article ID for revisions/corrections
        let baseArticleId;
        if (newRevisionID) {
            baseArticleId = newRevisionID.split('.')[0]; // Get part before dot
        } else {
            baseArticleId = articleID;
        }

        // Get counts from the original article if this is a revision/correction
        let revisionsCount = 0;
        let correctionsCount = 0;
        
        if (newRevisionID && (process === "revision" || process === "correction")) {
            try {
                const [originalData] = await dbPromise.query(
                    "SELECT revisions_count, corrections_count FROM submissions WHERE article_id = ? ORDER BY date_submitted DESC LIMIT 1", 
                    [baseArticleId]
                );
                
                if (originalData && originalData[0]) {
                    revisionsCount = originalData[0].revisions_count || 0;
                    correctionsCount = originalData[0].corrections_count || 0;
                }
            } catch (error) {
                console.error("Error fetching original article counts:", error);
                // Continue with default counts
            }
        }

        // Database operation with retry logic
        try {
            await retryWithBackoff(async () => {
                let connection;
                try {
                    connection = await dbPromise.getConnection();
                    await connection.beginTransaction();

                    // Check if submission already exists
                    const [existingRecords] = await connection.query(
                        "SELECT * FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ?", 
                        [articleID, correspondingAuthor]
                    );

                    if (existingRecords.length > 0) {
                        // Update existing submission
                        const [updateResult] = await connection.query(
                            `UPDATE submissions SET 
                                article_type = ?, 
                                discipline = ?, 
                                previous_manuscript_id = ?, 
                                is_women_in_contemporary_science = ?, 
                                status = ?,
                                last_updated = NOW()
                             WHERE revision_id = ?`, 
                            [article_type, discipline, previous_manuscript_id, 
                             is_women_in_contemporary_science, submissionStatus, articleID]
                        );

                        if (updateResult.affectedRows === 0) {
                            throw new Error("No rows affected during update");
                        }
                    } else {
                        // Insert new submission
                        const [insertResult] = await connection.query(
                            `INSERT INTO submissions SET 
                                article_id = ?,
                                revision_id = ?,
                                article_type = ?,
                                discipline = ?,
                                corresponding_authors_email = ?,
                                is_women_in_contemporary_science = ?,
                                status = ?,
                                revisions_count = ?,
                                corrections_count = ?,
                                previous_manuscript_id = ?,

                                last_updated = NOW()`, 
                            [baseArticleId, articleID, article_type, discipline, 
                             correspondingAuthor, is_women_in_contemporary_science, 
                             submissionStatus, revisionsCount, correctionsCount, 
                             previous_manuscript_id]
                        );

                        if (insertResult.affectedRows === 0) {
                            throw new Error("No rows affected during insert");
                        }

                        // If this is a revision or correction, update the original article counts
                        if (process === "revision" || process === "correction") {
                            const updateField = process === "revision" ? "revisions_count" : "corrections_count";
                            const newCount = process === "revision" ? revisionsCount + 1 : correctionsCount + 1;
                            
                            const [countUpdateResult] = await connection.query(
                                `UPDATE submissions SET ${updateField} = ?, last_updated = NOW() 
                                 WHERE article_id = ? AND revision_id = ?`, 
                                [newCount, baseArticleId, baseArticleId]
                            );

                            if (countUpdateResult.affectedRows === 0) {
                                console.warn("Count update did not affect any rows");
                            }
                        }
                    }

                    await connection.commit();
                    return true;
                    
                } catch (error) {
                    if (connection) {
                        await connection.rollback();
                    }
                    throw error;
                } finally {
                    if (connection) {
                        connection.release();
                    }
                }
            }, 3, 500);

            // Update session data
            if (!req.session.manuscriptData) {
                req.session.manuscriptData = {};
            }
            
            req.session.manuscriptData.process = process;
            req.session.articleId = articleID;
            
            // Save session explicitly
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error("Session save error:", saveErr);
                }
                
                return res.json({ 
                    success: "Progress has been saved", 
                    article_id: articleID,
                    revision_id: articleID,
                    process: process
                });
            });

        } catch (dbError) {
            console.error("Database operation failed after retries:", dbError);
            return res.status(500).json({ 
                error: "Failed to save article type",
                details: process.env.NODE_ENV === 'development' ? dbError.message : "Please try again"
            });
        }

    } catch (error) {
        console.error("System error:", error);
        return res.status(500).json({ 
            error: "System error",
            details: process.env.NODE_ENV === 'development' ? error.message : "Please try again later"
        });
    }
};

module.exports = submitArticleType;