const db = require("../routes/db.config");
const multer = require("multer");
const SendNewSubmissionEmail = require("./utils/sendNewSubmissionEmail");
const sendEmailToHandler = require("./utils/SendHandlerEmail");
const CoAuthors = require("./CoAuthors");
const dbPromise = require("../routes/dbPromise.config");
const upload = multer();
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

const SubmitDisclosures = async (req, res) => {
    upload.none()(req, res, async (err) => {
        if (err) {
            console.error("Multer error:", err);
            return res.status(400).json({ 
                status: "error", 
                error: "Invalid form data format",
                message: "Please check your form data and try again"
            });
        }

        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ 
                    error: "Session is Not Valid, please login again",
                    message: "Your session has expired. Please log in again."
                });
            }

            const { manuscript_id, review_status, current_process } = req.body;
            const articleId = req.session.articleId;
            
            if (!articleId) {
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

                        // Get manuscript data
                        const [paper] = await connection.query(
                            "SELECT * FROM submissions WHERE revision_id = ?", 
                            [articleId]
                        );

                        if (!paper || paper.length === 0) {
                            throw new Error("Paper not found");
                        }

                        const manuscript = paper[0];
                       
                        const { corresponding_authors_email, title, manuscript_file, cover_letter_file, document_file } = manuscript;

                        // FIXED: Better file validation and update logic
                        // Check if we have any files to update from session
                        const hasSessionManuscript = req.session.manuscriptData?.manuscript_file && req.session.manuscriptData.manuscript_file !== '';
                        const hasSessionCoverLetter = req.session.manuscriptData?.cover_letter_file && req.session.manuscriptData.cover_letter_file !== '';
                        const hasSessionDocument = req.session.manuscriptData?.document_file && req.session.manuscriptData.document_file !== '';

                        // Determine which files to use - session files take precedence over database files
                        const finalManuscriptFile = hasSessionManuscript ? req.session.manuscriptData.manuscript_file : manuscript_file;
                        const finalCoverLetter = hasSessionCoverLetter ? req.session.manuscriptData.cover_letter_file : cover_letter_file;
                        const finalDocumentFile = hasSessionDocument ? req.session.manuscriptData.document_file : document_file;

                        // Validate that we have a manuscript file (either from session or database)
                        if (!finalManuscriptFile || finalManuscriptFile === '') {
                            throw new Error("Manuscript file not uploaded");
                        }

                        // Update files in database if we have any session files to update
                        if (hasSessionManuscript || hasSessionCoverLetter || hasSessionDocument) {
                            console.log("Updating files for article:", articleId);
                            console.log("Manuscript file:", hasSessionManuscript ? "From session" : "From database");
                            console.log("Cover letter:", hasSessionCoverLetter ? "From session" : "From database");
                            console.log("Document file:", hasSessionDocument ? "From session" : "From database");
                            
                            await connection.query(
                                "UPDATE submissions SET manuscript_file = ?, cover_letter_file = ?, document_file = ? WHERE revision_id = ?", 
                                [finalManuscriptFile, finalCoverLetter, finalDocumentFile, articleId]
                            );
                        }

                        // Update submission status
                        const [updateResult] = await connection.query(
                            "UPDATE submissions SET status = ?, last_updated = NOW() WHERE revision_id = ?",
                            [review_status, articleId]
                        );

                        if (updateResult.affectedRows === 0) {
                            throw new Error("Manuscript could not be updated");
                        }

                        // Handle submission workflow
                        if (review_status === "submitted") {
                            // Send notifications (outside transaction since they're external)
                            const userFullname = `${req.user.prefix || ''} ${req.user.firstname || ''} ${req.user.lastname || ''} ${req.user.othername || ''}`.trim();
                            
                            // Update previous versions
                            const updatedStatus = current_process?.replace('saved', 'submitted') || 'submitted';
                            await connection.query(
                                "UPDATE submissions SET status = ?, last_updated = NOW() WHERE article_id = ? AND revision_id != ?",
                                [updatedStatus, manuscript_id, articleId]
                            );

                            await connection.commit();

                            // Send emails after successful commit
                            try {
                                await Promise.allSettled([
                                    SendNewSubmissionEmail(corresponding_authors_email, title, articleId),
                                    sendEmailToHandler("submissions@asfirj.org", title, articleId, userFullname),
                                    CoAuthors(req, res, articleId)
                                ]);
                            } catch (emailError) {
                                console.error("Email sending failed:", emailError);
                                // Continue despite email errors since submission was successful
                            }

                            // Clear session data
                            req.session.manuscriptData = null;
                            req.session.article_data = null;
                            req.session.articleId = null;

                            // Save session explicitly
                            req.session.save((saveErr) => {
                                if (saveErr) {
                                    console.error("Session save error:", saveErr);
                                }
                                
                                return res.json({ 
                                    success: true,
                                    message: "Manuscript submitted successfully",
                                    manuscriptId: articleId
                                });
                            });

                        } else {
                            // For saved status, just commit and return
                            await connection.commit();
                            
                            return res.json({ 
                                success: true,
                                message: "Manuscript saved successfully",
                                manuscriptId: articleId
                            });
                        }
                        
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

            } catch (dbError) {
                console.error("Database operation failed:", dbError);
                
                if (dbError.message === "Paper not found") {
                    return res.status(404).json({ 
                        error: "Paper not found",
                        message: "The specified manuscript does not exist"
                    });
                }
                
                if (dbError.message === "Manuscript file not uploaded") {
                    return res.status(400).json({ 
                        error: "Upload a manuscript file to continue",
                        message: "Please upload your manuscript file before submitting"
                    });
                }
                
                if (dbError.message === "Manuscript could not be updated") {
                    return res.status(500).json({ 
                        error: "Update failed",
                        message: "Failed to update manuscript status"
                    });
                }
                
                return res.status(500).json({ 
                    error: "Database operation failed",
                    message: "Failed to process submission",
                    details: process.env.NODE_ENV === 'development' ? dbError.message : "Please try again"
                });
            }

        } catch (error) {
            console.error("Submission processing error:", error);
            return res.status(500).json({ 
                status: "error", 
                error: "System error",
                message: "An unexpected error occurred",
                details: process.env.NODE_ENV === 'development' ? error.message : "Please try again later"
            });
        }
    });
};

module.exports = SubmitDisclosures;