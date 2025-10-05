const db = require("../routes/db.config");
const multer = require("multer");
const SendNewSubmissionEmail = require("./utils/sendNewSubmissionEmail");
const sendEmailToHandler = require("./utils/SendHandlerEmail");
const CoAuthors = require("./CoAuthors");
const dbPromise = require("../routes/dbPromise.config");
const { retryOperation } = require("./manuscriptData_middleware");
const upload = multer();
const dotenv = require("dotenv").config();

// Import the shared retry function from manuscriptDataMiddleware

// Enhanced retry helper with deadlock handling
async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    return retryOperation(operation, maxRetries, baseDelay);
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
            const articleId = req.session.manuscriptData?.sessionID || req.session.articleId;

            if (!articleId) {
                return res.status(400).json({
                    error: "No active manuscript session",
                    message: "Please start a new submission or reload your existing manuscript"
                });
            }

            console.log(`Processing submission for article: ${articleId}, status: ${review_status}`);

            // Database operation with enhanced retry logic
            await retryWithBackoff(async () => {
                let connection;
                try {
                    connection = await dbPromise.getConnection();
                    await connection.beginTransaction();

                    // Get manuscript data with specific column selection to reduce lock contention
                    const [paper] = await connection.query(
                        "SELECT revision_id, article_id, corresponding_authors_email, title, manuscript_file, cover_letter_file, document_file, status FROM submissions WHERE revision_id = ? FOR UPDATE",
                        [articleId]
                    );

                    if (!paper || paper.length === 0) {
                        throw new Error("Paper not found");
                    }

                    const manuscript = paper[0];
                    const { corresponding_authors_email, title, manuscript_file, cover_letter_file, document_file } = manuscript;

                    // Helper: get URL from session files
                    const getSessionFileUrl = (fileData) => {
                        if (!fileData) return null;

                        if (Array.isArray(fileData)) {
                            return fileData[0]?.url || null;
                        }
                        if (fileData && typeof fileData === 'object' && fileData.url) {
                            return fileData.url;
                        }
                        return fileData;
                    };

                    // Check if we have new session files
                    const hasSessionManuscript = req.session.manuscriptData?.manuscript_file &&
                        getSessionFileUrl(req.session.manuscriptData.manuscript_file) !== '';
                    const hasSessionCoverLetter = req.session.manuscriptData?.cover_letter_file &&
                        getSessionFileUrl(req.session.manuscriptData.cover_letter_file) !== '';
                    const hasSessionDocument = req.session.manuscriptData?.document_file &&
                        req.session.manuscriptData.document_file !== '';

                    // Final file values
                    const finalManuscriptFile = hasSessionManuscript
                        ? getSessionFileUrl(req.session.manuscriptData.manuscript_file)
                        : manuscript_file;

                    const finalCoverLetter = hasSessionCoverLetter
                        ? getSessionFileUrl(req.session.manuscriptData.cover_letter_file)
                        : cover_letter_file;

                    const finalDocumentFile = hasSessionDocument
                        ? req.session.manuscriptData.document_file
                        : document_file;

                    // Must have manuscript
                    if (!finalManuscriptFile || finalManuscriptFile === '') {
                        throw new Error("Manuscript file not uploaded");
                    }

                    // Update files if session has new ones - use conditional updates to reduce locking
                    if (hasSessionManuscript || hasSessionCoverLetter || hasSessionDocument) {
                        const updateFields = [];
                        const updateValues = [];

                        if (hasSessionManuscript) {
                            updateFields.push("manuscript_file = ?");
                            updateValues.push(finalManuscriptFile);
                        }
                        if (hasSessionCoverLetter) {
                            updateFields.push("cover_letter_file = ?");
                            updateValues.push(finalCoverLetter);
                        }
                        if (hasSessionDocument) {
                            updateFields.push("document_file = ?");
                            updateValues.push(finalDocumentFile);
                        }

                        if (updateFields.length > 0) {
                            updateValues.push(articleId);
                            await connection.query(
                                `UPDATE submissions SET ${updateFields.join(", ")} WHERE revision_id = ?`,
                                updateValues
                            );
                        }
                    }

                    // Update submission status with minimal locking
                    const [updateResult] = await connection.query(
                        "UPDATE submissions SET status = ?, last_updated = NOW() WHERE revision_id = ?",
                        [review_status, articleId]
                    );

                    if (updateResult.affectedRows === 0) {
                        throw new Error("Manuscript could not be updated");
                    }

                    if (review_status === "submitted") {
                        // Update previous versions - use quick updates without transactions if possible
                        const updatedStatus = current_process?.replace('saved', 'submitted') || 'submitted';
                        
                        // Only update if we have a manuscript_id and it's different from current articleId
                        if (manuscript_id && manuscript_id !== articleId) {
                            await connection.query(
                                "UPDATE submissions SET status = ?, last_updated = NOW() WHERE article_id = ? AND revision_id != ? AND status != 'submitted'",
                                [updatedStatus, manuscript_id, articleId]
                            );
                        }

                        await connection.commit();
                        console.log(`Submission committed successfully for: ${articleId}`);

                        // Send notifications outside of transaction to reduce lock time
                        const userFullname = `${req.user.prefix || ''} ${req.user.firstname || ''} ${req.user.lastname || ''} ${req.user.othername || ''}`.trim();
                        
                        // Use Promise.allSettled to ensure one email failure doesn't block others
                        try {
                            const emailResults = await Promise.allSettled([
                                SendNewSubmissionEmail(corresponding_authors_email, title, articleId),
                                sendEmailToHandler("submissions@asfirj.org", title, articleId, userFullname),
                                CoAuthors(req, res, articleId)
                            ]);

                            // Log email results for debugging
                            emailResults.forEach((result, index) => {
                                if (result.status === 'rejected') {
                                    console.warn(`Email ${index} failed:`, result.reason);
                                }
                            });
                        } catch (emailError) {
                            console.error("Email sending failed:", emailError);
                            // Don't throw error - email failure shouldn't fail the submission
                        }

                        // Destroy session & clear cookie
                        req.session.destroy((destroyErr) => {
                            if (destroyErr) {
                                console.error("Session destroy error:", destroyErr);
                            }
                            res.clearCookie("connect.sid", { path: "/" });

                            return res.json({
                                success: true,
                                message: "Manuscript submitted successfully",
                                manuscriptId: articleId
                            });
                        });

                    } else {
                        // Saved only - commit transaction
                        await connection.commit();
                        console.log(`Manuscript saved successfully for: ${articleId}`);
                        
                        return res.json({
                            success: true,
                            message: "Manuscript saved successfully",
                            manuscriptId: articleId
                        });
                    }

                } catch (error) {
                    if (connection) {
                        try {
                            await connection.rollback();
                            console.log("Transaction rolled back due to error:", error.message);
                        } catch (rollbackError) {
                            console.error("Rollback failed:", rollbackError);
                        }
                    }
                    
                    // Re-throw for retry mechanism
                    throw error;
                } finally {
                    if (connection) {
                        connection.release();
                    }
                }
            }, 3, 500); // 3 retries with 500ms base delay

        } catch (error) {
            console.error("Submission processing error:", error);
            
            // Provide specific error messages based on error type
            let userMessage = "An unexpected error occurred";
            let errorType = "System error";
            
            if (error.code === 'ER_LOCK_DEADLOCK' || error.errno === 1213) {
                userMessage = "The system is busy processing other submissions. Please try again in a moment.";
                errorType = "System Busy";
            } else if (error.message === "Manuscript file not uploaded") {
                userMessage = "Please upload a manuscript file before submitting.";
                errorType = "Missing File";
            } else if (error.message === "Paper not found") {
                userMessage = "The manuscript could not be found. Please start a new submission.";
                errorType = "Manuscript Not Found";
            }
            
            return res.status(500).json({
                status: "error",
                error: errorType,
                message: userMessage,
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                retrySuggested: error.code === 'ER_LOCK_DEADLOCK'
            });
        }
    });
};

// Export the retry function for use in other modules
module.exports = SubmitDisclosures;
module.exports.retryWithBackoff = retryWithBackoff;