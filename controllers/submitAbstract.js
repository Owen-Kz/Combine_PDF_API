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

const submitAbstract = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.json({ error: "Session is Not Valid, please login again" });
        }
        
        const correspondingAuthor = req.user.email;
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

        // Database operation with retry logic
        try {
            await retryWithBackoff(async () => {
                let connection;
                try {
                    connection = await dbPromise.getConnection();
                    await connection.beginTransaction();

                    // Check if manuscript exists
                    const [existingRecords] = await connection.query(
                        "SELECT * FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ?", 
                        [article_id, correspondingAuthor]
                    );

                    if (existingRecords.length === 0) {
                        throw new Error("Manuscript not found");
                    }

                    // Update abstract in database
                    const [updateResult] = await connection.query(
                        "UPDATE submissions SET abstract = ?, last_updated = NOW() WHERE revision_id = ?", 
                        [abstract, article_id]
                    );

                    if (updateResult.affectedRows === 0) {
                        throw new Error("No changes made to manuscript");
                    }

                    // Update session data
                    if (!req.session.manuscriptData) {
                        req.session.manuscriptData = {};
                    }
                    req.session.manuscriptData.abstract = abstract;

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

            // Save session explicitly
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error("Session save error:", saveErr);
                    // Continue anyway since the database update was successful
                }
                
                return res.json({ 
                    success: true,
                    message: "Abstract saved successfully",
                    article_id: article_id
                });
            });

        } catch (dbError) {
            console.error("Database operation failed:", dbError);
            
            if (dbError.message === "Manuscript not found") {
                return res.status(404).json({ 
                    error: "Manuscript not found",
                    message: "The specified manuscript does not exist"
                });
            }
            
            if (dbError.message === "No changes made to manuscript") {
                return res.status(404).json({ 
                    error: "No changes made",
                    message: "The manuscript was not updated"
                });
            }
            
            return res.status(500).json({ 
                error: "Database operation failed",
                message: "Failed to save abstract to database",
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

module.exports = submitAbstract;