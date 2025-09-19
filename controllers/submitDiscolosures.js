const db = require("../routes/db.config");
const multer = require("multer");
const SendNewSubmissionEmail = require("./utils/sendNewSubmissionEmail");
const sendEmailToHandler = require("./utils/SendHandlerEmail");
const CoAuthors = require("./CoAuthors");
const dbPromise = require("../routes/dbPromise.config");
const upload = multer();
const dotenv = require("dotenv").config();

// Retry helper
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

                    // Update files if session has new ones
                    if (hasSessionManuscript || hasSessionCoverLetter || hasSessionDocument) {
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

                    if (review_status === "submitted") {
                        // Update previous versions
                        const updatedStatus = current_process?.replace('saved', 'submitted') || 'submitted';
                        await connection.query(
                            "UPDATE submissions SET status = ?, last_updated = NOW() WHERE article_id = ? AND revision_id != ?",
                            [updatedStatus, manuscript_id, articleId]
                        );

                        await connection.commit();

                        // Send notifications
                        const userFullname = `${req.user.prefix || ''} ${req.user.firstname || ''} ${req.user.lastname || ''} ${req.user.othername || ''}`.trim();
                        try {
                            await Promise.allSettled([
                                SendNewSubmissionEmail(corresponding_authors_email, title, articleId),
                                sendEmailToHandler("submissions@asfirj.org", title, articleId, userFullname),
                                CoAuthors(req, res, articleId)
                            ]);
                        } catch (emailError) {
                            console.error("Email sending failed:", emailError);
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
                        // Saved only
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
