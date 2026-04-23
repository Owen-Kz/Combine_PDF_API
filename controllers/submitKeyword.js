const db = require("../routes/db.config");
const dbPromise = require("../routes/dbPromise.config");
const dotenv = require("dotenv").config();

// Consistent retry function with other modules
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

const submitKeyword = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.json({ error: "Session is Not Valid, please login again" });
        }
        
        const correspondingAuthor = req.user.email;
        const { keyword } = req.body;

        // Validate keyword exists and is not empty
        if (!keyword || keyword.trim() === "") {
            return res.status(400).json({ 
                error: "Keyword cannot be empty",
                message: "Please provide a valid keyword"
            });
        }

        const article_id = req.session.articleId;
        if (!article_id) {
            return res.status(400).json({ 
                error: "No active manuscript session",
                message: "Please start a new submission or reload your existing manuscript"
            });
        }

        // Database operation with retry logic
        try {
            const result = await retryWithBackoff(async () => {
                let connection;
                try {
                    connection = await dbPromise.getConnection();
                    await connection.beginTransaction();

                    // First, verify the manuscript exists and belongs to the user
                    const [manuscriptRecords] = await connection.query(
                        "SELECT revision_id FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ?", 
                        [article_id, correspondingAuthor]
                    );

                    if (manuscriptRecords.length === 0) {
                        throw new Error("Manuscript not found or access denied");
                    }

                    // Check if keyword already exists for this article
                    const [existingKeywords] = await connection.query(
                        "SELECT id FROM submission_keywords WHERE article_id = ? AND keyword = ?", 
                        [article_id, keyword]
                    );

                    let operation;
                    
                    if (existingKeywords.length > 0) {
                        // Update existing keyword
                        const [updateResult] = await connection.query(
                            "UPDATE submission_keywords SET keyword = ?, last_updated = NOW() WHERE article_id = ? AND id = ?", 
                            [keyword, article_id, existingKeywords[0].id]
                        );

                        if (updateResult.affectedRows === 0) {
                            throw new Error("Keyword update failed");
                        }
                        
                        operation = "updated";
                    } else {
                        // Insert new keyword
                        const [insertResult] = await connection.query(
                            "INSERT INTO submission_keywords (keyword, article_id, created_at, last_updated) VALUES (?, ?, NOW(), NOW())", 
                            [keyword, article_id]
                        );

                        if (insertResult.affectedRows === 0) {
                            throw new Error("Keyword insertion failed");
                        }
                        
                        operation = "added";
                    }

                    await connection.commit();
                    return operation;
                    
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

            // Update keyword count in session
            if (!req.session.manuscriptData) {
                req.session.manuscriptData = {};
            }
            
            if (result === "added") {
                const currentCount = req.session.manuscriptData.KeyCount || 0;
                req.session.manuscriptData.KeyCount = currentCount + 1;
            }

            // Save session explicitly
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error("Session save error:", saveErr);
                    // Continue anyway since the database update was successful
                }
                
                return res.json({ 
                    success: true,
                    message: `Keyword ${result} successfully`,
                    article_id: article_id,
                    operation: result
                });
            });

        } catch (dbError) {
            console.error("Database operation failed:", dbError);
            
            if (dbError.message === "Manuscript not found or access denied") {
                return res.status(404).json({ 
                    error: "Manuscript not found",
                    message: "The specified manuscript does not exist or you don't have access to it"
                });
            }
            
            if (dbError.message.includes("failed")) {
                return res.status(500).json({ 
                    error: "Database operation failed",
                    message: "Failed to save keyword to database",
                    details: process.env.NODE_ENV === 'development' ? dbError.message : "Please try again"
                });
            }
            
            return res.status(500).json({ 
                error: "Database error",
                message: "An unexpected database error occurred",
                details: process.env.NODE_ENV === 'development' ? dbError.message : "Please try again"
            });
        }

    } catch (error) {
        console.error("System error:", error);
        return res.status(500).json({ 
            error: "System error",
            message: "An unexpected error occurred",
            details: process.env.NODE_ENV === 'development' ? error.message : "Please try again later"
        });
    }
};

module.exports = submitKeyword;