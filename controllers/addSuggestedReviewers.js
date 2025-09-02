const db = require("../routes/db.config");
const multer = require("multer");
const dbPromise = require("../routes/dbPromise.config");
const upload = multer();

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

const AddReviewerToPaper = async (req, res) => {
    upload.none()(req, res, async (err) => {
        if (err) {
            console.error("Multer error:", err);
            return res.status(400).json({ 
                status: "error", 
                error: "Invalid form data format" 
            });
        }

        try {
            if (!req.user || !req.user.id) {
                return res.json({ error: "Session is Not Valid, please login again" });
            }

            const {
                suggested_reviewer_fullname,
                suggested_reviewer_affiliation,
                suggested_reviewer_country,
                suggested_reviewer_city,
                suggested_reviewer_email
            } = req.body;

            // Get submission ID from session
            const mainSubmissionId = req.session.articleId;
            if (!mainSubmissionId) {
                return res.status(400).json({ 
                    status: "error", 
                    error: "No active manuscript session",
                    message: "Please start a new submission or reload your existing manuscript"
                });
            }

            // Normalize input to array
            const emails = Array.isArray(suggested_reviewer_email) ? 
                suggested_reviewer_email : 
                [suggested_reviewer_email].filter(Boolean);

            if (emails.length === 0) {
                return res.status(400).json({ 
                    status: "error", 
                    error: "At least one reviewer email is required",
                    message: "Please provide at least one reviewer email address"
                });
            }

            // Process reviewers with transaction support
            const insertedReviewers = [];
            const skippedReviewers = [];

            try {
                await retryWithBackoff(async () => {
                    let connection;
                    try {
                        connection = await dbPromise.getConnection();
                        await connection.beginTransaction();

                        // Verify the manuscript exists and belongs to the user
                        const [manuscriptRecords] = await connection.query(
                            "SELECT revision_id FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ?", 
                            [mainSubmissionId, req.user.email]
                        );

                        if (manuscriptRecords.length === 0) {
                            throw new Error("Manuscript not found or access denied");
                        }

                        for (let i = 0; i < emails.length; i++) {
                            const reviewerEmail = emails[i]?.trim();
                            if (!reviewerEmail) continue;

                            const fullName = suggested_reviewer_fullname?.[i]?.trim() || '';
                            const affiliation = suggested_reviewer_affiliation?.[i]?.trim() || '';
                            const country = suggested_reviewer_country?.[i]?.trim() || '';
                            const city = suggested_reviewer_city?.[i]?.trim() || '';

                            try {
                                // Check if reviewer exists or is an author
                                const [existingReviewer] = await connection.query(
                                    "SELECT id FROM suggested_reviewers WHERE email = ? AND article_id = ?",
                                    [reviewerEmail, mainSubmissionId]
                                );

                                const [existingAuthor] = await connection.query(
                                    "SELECT id FROM submission_authors WHERE authors_email = ? AND submission_id = ?",
                                    [reviewerEmail, mainSubmissionId]
                                );

                                if (existingReviewer.length === 0 && existingAuthor.length === 0) {
                                    // Insert new reviewer
                                    const [insertResult] = await connection.query(
                                        `INSERT INTO suggested_reviewers 
                                         (article_id, fullname, email, affiliation, affiliation_country, affiliation_city, created_at, last_updated) 
                                         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                                        [mainSubmissionId, fullName, reviewerEmail, affiliation, country, city]
                                    );

                                    if (insertResult.affectedRows > 0) {
                                        insertedReviewers.push(reviewerEmail);
                                    } else {
                                        skippedReviewers.push({
                                            email: reviewerEmail,
                                            reason: "insertion_failed"
                                        });
                                    }
                                } else {
                                    skippedReviewers.push({
                                        email: reviewerEmail,
                                        reason: existingReviewer.length > 0 ? "already_suggested" : "is_author"
                                    });
                                }
                            } catch (reviewerError) {
                                console.error(`Error processing reviewer ${reviewerEmail}:`, reviewerError);
                                skippedReviewers.push({
                                    email: reviewerEmail,
                                    reason: "processing_error",
                                    details: process.env.NODE_ENV === 'development' ? reviewerError.message : undefined
                                });
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

                return res.json({ 
                    status: "success",
                    success: "Reviewers processed successfully",
                    inserted: insertedReviewers,
                    skipped: skippedReviewers,
                    article_id: mainSubmissionId
                });

            } catch (dbError) {
                console.error("Database operation failed:", dbError);
                
                if (dbError.message === "Manuscript not found or access denied") {
                    return res.status(404).json({ 
                        status: "error",
                        error: "Manuscript not found",
                        message: "The specified manuscript does not exist or you don't have access to it"
                    });
                }
                
                return res.status(500).json({ 
                    status: "error", 
                    error: "Database operation failed",
                    message: "Failed to process reviewers",
                    details: process.env.NODE_ENV === 'development' ? dbError.message : "Please try again"
                });
            }

        } catch (error) {
            console.error("System error processing reviewers:", error);
            return res.status(500).json({ 
                status: "error", 
                error: "System error",
                message: "An unexpected error occurred",
                details: process.env.NODE_ENV === 'development' ? error.message : "Please try again later"
            });
        }
    });
};

module.exports = AddReviewerToPaper;