const db = require("../routes/db.config");
const multer = require("multer");
const SendNewSubmissionEmail = require("./utils/sendNewSubmissionEmail");
const sendEmailToHandler = require("./utils/SendHandlerEmail");
const CoAuthors = require("./CoAuthors");
const dbPromise = require("../routes/dbPromise.config");

const SubmissionManager = require("./utils/SubmissionManager.js");
const { retryOperation } = require("./generateArticleId.js");
const upload = multer();
const dotenv = require("dotenv").config();

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

            // Check if we have submission data from middleware
            if (!req.submissionData || !req.articleId) {
                return res.status(400).json({
                    error: "No active manuscript session",
                    message: "Please start a new submission or reload your existing manuscript"
                });
            }

            const { manuscript_id, review_status, current_process, draft_id } = req.body;
            
            // Use articleId from middleware
            const articleId = req.articleId;
            const submissionData = req.submissionData;

            console.log(`Processing submission for article: ${articleId}, status: ${review_status}`, {
                isNewSubmission: submissionData.isNew,
                currentStatus: submissionData.submission?.status || 'draft'
            });

            // Database operation with enhanced retry logic
            await retryWithBackoff(async () => {
                let connection;
                try {
                    connection = await dbPromise.getConnection();
                    await connection.beginTransaction();

                    // For new submissions, we need to ensure basic data exists
                    if (submissionData.isNew) {
                        // Create basic submission record if it doesn't exist
                        const [existingRecords] = await connection.query(
                            "SELECT revision_id FROM submissions WHERE revision_id = ?",
                            [articleId]
                        );

                        if (existingRecords.length === 0) {
                            // Insert minimal submission record for new submissions
                            await connection.query(
                                `INSERT INTO submissions 
                                 (revision_id, article_id, corresponding_authors_email, status, created_at, last_updated) 
                                 VALUES (?, ?, ?, ?, NOW(), NOW())`,
                                [articleId, articleId, req.user.email, 'draft']
                            );
                            console.log(`Created new submission record for: ${articleId}`);
                        }
                    }

                    // Get manuscript data with ALL file fields from database
                    const [paper] = await connection.query(
                        `SELECT 
                            revision_id, 
                            article_id, 
                            corresponding_authors_email, 
                            title, 
                            manuscript_file, 
                            cover_letter_file, 
                            document_file,
                            tracked_manuscript_file,
                            tables,
                            figures,
                            graphic_abstract,
                            supplementary_material,
                            status,
                            discipline,
                            article_type,
                            abstract,
                            is_women_in_contemporary_science,
                            previous_manuscript_id
                         FROM submissions 
                         WHERE revision_id = ? AND corresponding_authors_email = ? FOR UPDATE`,
                        [articleId, req.user.email]
                    );

                    if (!paper || paper.length === 0) {
                        throw new Error("Paper not found or access denied");
                    }

                    const manuscript = paper[0];
                    const { 
                        corresponding_authors_email, 
                        title, 
                        manuscript_file, 
                        cover_letter_file, 
                        document_file,
                        tracked_manuscript_file,
                        tables,
                        figures,
                        graphic_abstract,
                        supplementary_material,
                        discipline,
                        article_type,
                        abstract,
                        is_women_in_contemporary_science,
                        previous_manuscript_id
                    } = manuscript;

                    // Helper function to check if file exists in database
                    const hasFileInDatabase = (fileField) => {
                        return fileField && fileField !== '' && fileField !== null;
                    };

                    // Check file requirements from database
                    const hasManuscriptFile = hasFileInDatabase(manuscript_file);
                    const hasCoverLetterFile = hasFileInDatabase(cover_letter_file);
                    const hasDocumentFile = hasFileInDatabase(document_file);

                    // Must have manuscript file in database
                    if (!hasManuscriptFile) {
                        throw new Error(`Manuscript file not uploaded for submission ${articleId}`);
                    }

                    // Validate required fields for submission
                    const validationErrors = [];
                    if (!title || title.trim() === '') {
                        validationErrors.push("Title is required");
                    }
                    if (!abstract || abstract.trim() === '') {
                        validationErrors.push("Abstract is required");
                    }
                    if (!article_type || article_type.trim() === '') {
                        validationErrors.push("Article type is required");
                    }
                    if (!discipline || discipline.trim() === '') {
                        validationErrors.push("Discipline is required");
                    }
                    if (!is_women_in_contemporary_science) {
                        validationErrors.push("Women in Contemporary Science selection is required");
                    }

                    // Check for authors (at least one author required)
                    const [authors] = await connection.query(
                        "SELECT id FROM submission_authors WHERE submission_id = ?",
                        [articleId]
                    );
                    if (authors.length === 0) {
                        validationErrors.push("At least one author is required");
                    }

                    if (validationErrors.length > 0) {
                        throw new Error(`Missing required fields: ${validationErrors.join(', ')}`);
                    }

                    // Log file status for debugging
                    console.log(`File status for ${articleId}:`, {
                        manuscript: hasManuscriptFile ? '✓' : '✗',
                        cover_letter: hasCoverLetterFile ? '✓' : '✗',
                        document: hasDocumentFile ? '✓' : '✗',
                        tracked_manuscript: hasFileInDatabase(tracked_manuscript_file) ? '✓' : '✗',
                        tables: hasFileInDatabase(tables) ? '✓' : '✗',
                        figures: hasFileInDatabase(figures) ? '✓' : '✗',
                        graphic_abstract: hasFileInDatabase(graphic_abstract) ? '✓' : '✗',
                        supplementary_material: hasFileInDatabase(supplementary_material) ? '✓' : '✗',
                        title: title ? '✓' : '✗',
                        abstract: abstract ? '✓' : '✗',
                        article_type: article_type ? '✓' : '✗',
                        discipline: discipline ? '✓' : '✗',
                        women_in_science: is_women_in_contemporary_science ? '✓' : '✗',
                        authors: authors.length > 0 ? '✓' : '✗'
                    });

                    // Update submission status
                    const updateFields = {
                        status: review_status,
                        last_updated: new Date()
                    };

                    // If submitting, set the submission date
                    if (review_status === "submitted") {
                        updateFields.date_submitted = new Date();
                    }

                    const [updateResult] = await connection.query(
                        "UPDATE submissions SET ? WHERE revision_id = ? AND corresponding_authors_email = ?",
                        [updateFields, articleId, req.user.email]
                    );

                    if (updateResult.affectedRows === 0) {
                        throw new Error("Manuscript could not be updated");
                    }

                    if (review_status === "submitted") {
                        // Update previous versions if this is a revision
                        const updatedStatus = current_process?.replace('saved', 'submitted') || 'submitted';
                        
                        if (previous_manuscript_id && previous_manuscript_id !== articleId) {
                            await connection.query(
                                "UPDATE submissions SET status = ?, last_updated = NOW() WHERE article_id = ? AND revision_id != ? AND status != 'submitted'",
                                [updatedStatus, previous_manuscript_id, articleId]
                            );
                        }

                        await connection.commit();
                        console.log(`Submission committed successfully for: ${articleId}`);

                        // CLEAR SESSION DATA TO PREVENT RELOADING THE SAME SUBMISSION
                        if (req.session) {
                            console.log("Clearing session data for completed submission:", articleId);
                            delete req.session.articleId;
                            delete req.session.manuscriptData;
                            delete req.session.submissionData;
                            // Set a flag to indicate a submission was just completed
                            req.session.submissionCompleted = true;
                            req.session.lastSubmittedId = articleId;
                        }

                        // Send notifications outside of transaction
                        const userFullname = `${req.user.prefix || ''} ${req.user.firstname || ''} ${req.user.lastname || ''} ${req.user.othername || ''}`.trim();
                        
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
                                } else {
                                    console.log(`Email ${index} sent successfully`);
                                }
                            });
                        } catch (emailError) {
                            console.error("Email sending failed:", emailError);
                            // Don't throw error - email failure shouldn't fail the submission
                        }

                        return res.json({
                            success: true,
                            message: "Manuscript submitted successfully",
                            manuscriptId: articleId,
                            submissionCompleted: true, // Flag for frontend
                            data: {
                                title,
                                article_type,
                                discipline,
                                is_women_in_contemporary_science,
                                authors_count: authors.length,
                                files: {
                                    manuscript: hasManuscriptFile,
                                    cover_letter: hasCoverLetterFile,
                                    document: hasDocumentFile
                                },
                                submission_date: new Date().toISOString()
                            }
                        });

                    } else {
                        // Saved only - commit transaction
                        await connection.commit();
                        console.log(`Manuscript saved successfully for: ${articleId}`);
                        
                        return res.json({
                            success: true,
                            message: "Manuscript saved successfully",
                            manuscriptId: articleId,
                            data: {
                                status: 'saved',
                                last_updated: new Date().toISOString(),
                                files: {
                                    manuscript: hasManuscriptFile,
                                    cover_letter: hasCoverLetterFile,
                                    document: hasDocumentFile
                                },
                                authors_count: authors.length
                            }
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
            let statusCode = 500;
            
            if (error.code === 'ER_LOCK_DEADLOCK' || error.errno === 1213) {
                userMessage = "The system is busy processing other submissions. Please try again in a moment.";
                errorType = "System Busy";
            } else if (error.message.includes("Manuscript file not uploaded")) {
                userMessage = "Please upload a manuscript file before submitting.";
                errorType = "Missing File";
                statusCode = 400;
            } else if (error.message === "Paper not found" || error.message.includes("access denied")) {
                userMessage = "The manuscript could not be found or you don't have permission to access it.";
                errorType = "Manuscript Not Found";
                statusCode = 404;
            } else if (error.message.includes("Missing required fields")) {
                userMessage = error.message;
                errorType = "Validation Error";
                statusCode = 400;
            }
            
            console.error(`Error Type: ${errorType}, Message: ${userMessage}`);
            return res.status(statusCode).json({
                success: false,
                error: errorType,
                message: userMessage,
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                retrySuggested: error.code === 'ER_LOCK_DEADLOCK'
            });
        }
    });
};

// Additional function to check submission readiness using middleware data
SubmitDisclosures.checkSubmissionReadiness = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                error: "Authentication required"
            });
        }

        // Check if we have submission data from middleware
        if (!req.submissionData || !req.articleId) {
            return res.status(400).json({
                success: false,
                error: "No active manuscript session"
            });
        }

        const articleId = req.articleId;
        const submissionData = req.submissionData;

        let connection;
        try {
            connection = await dbPromise.getConnection();

            // Get submission data from database
            const [submission] = await connection.query(
                `SELECT 
                    title, abstract, article_type, discipline, status,
                    manuscript_file, cover_letter_file, document_file,
                    is_women_in_contemporary_science
                 FROM submissions 
                 WHERE revision_id = ? AND corresponding_authors_email = ?`,
                [articleId, req.user.email]
            );

            if (!submission || submission.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: "Submission not found"
                });
            }

            const manuscript = submission[0];

            // Get authors count
            const [authors] = await connection.query(
                "SELECT id FROM submission_authors WHERE submission_id = ?",
                [articleId]
            );

            // Check required fields
            const readiness = {
                isReady: true,
                missingFields: [],
                files: {
                    manuscript: !!manuscript.manuscript_file,
                    cover_letter: !!manuscript.cover_letter_file,
                    document: !!manuscript.document_file
                },
                authors_count: authors.length
            };

            if (!manuscript.title) {
                readiness.missingFields.push("Title");
                readiness.isReady = false;
            }
            if (!manuscript.abstract) {
                readiness.missingFields.push("Abstract");
                readiness.isReady = false;
            }
            if (!manuscript.article_type) {
                readiness.missingFields.push("Article Type");
                readiness.isReady = false;
            }
            if (!manuscript.discipline) {
                readiness.missingFields.push("Discipline");
                readiness.isReady = false;
            }
            if (!manuscript.is_women_in_contemporary_science) {
                readiness.missingFields.push("Women in Contemporary Science selection");
                readiness.isReady = false;
            }
            if (!manuscript.manuscript_file) {
                readiness.missingFields.push("Manuscript File");
                readiness.isReady = false;
            }
            if (authors.length === 0) {
                readiness.missingFields.push("At least one author");
                readiness.isReady = false;
            }

            return res.json({
                success: true,
                data: readiness,
                submission: {
                    title: manuscript.title,
                    article_type: manuscript.article_type,
                    discipline: manuscript.discipline,
                    status: manuscript.status,
                    is_new: submissionData.isNew
                }
            });

        } finally {
            if (connection) {
                connection.release();
            }
        }

    } catch (error) {
        console.error("Submission readiness check error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to check submission readiness",
            message: error.message
        });
    }
};

// Export the retry function for use in other modules
module.exports = SubmitDisclosures;
module.exports.retryWithBackoff = retryWithBackoff;