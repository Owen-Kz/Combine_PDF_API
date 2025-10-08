const db = require("../routes/db.config");
const multer = require("multer");
const dbPromise = require("../routes/dbPromise.config");
const { config } = require("dotenv");
const upload = multer();
config()

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

const AddAuthorToPaper = async (req, res) => {
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
                    status: "error", 
                    error: "No active manuscript session",
                    message: "Please start a new submission or reload your existing manuscript"
                });
            }

            const {
                loggedIn_authors_prefix,
                loggedIn_authors_first_name,
                loggedIn_authors_last_name,
                loggedIn_authors_other_name,
                loggedIn_authors_ORCID,
                loggedIn_affiliation,
                loggedIn_affiliation_country,
                loggedIn_affiliation_city,
                loggedIn_membership_id,
                authors_prefix,
                authors_first_name,
                authors_last_name,
                authors_other_name,
                authors_orcid,
                affiliation,
                affiliation_country,
                affiliation_city,
                membership_id,
                corresponding_author,
                email
            } = req.body;

            // Use articleId from middleware instead of session
            const mainSubmissionId = req.articleId;
            const submissionData = req.submissionData;

            console.log("Processing authors for submission:", {
                articleId: mainSubmissionId,
                userEmail: req.user.email,
                correspondingAuthor: corresponding_author,
                additionalAuthors: email
            });

            // Normalize emails to array
            const emails = Array.isArray(email) ? email : [email].filter(Boolean);
            const hasAuthors = emails.length > 0 || corresponding_author;
            
            if (!hasAuthors) {
                return res.status(400).json({ 
                    status: "error", 
                    error: "At least one author is required",
                    message: "Please add at least one author to the manuscript"
                });
            }

            const insertedAuthors = [];
            const skippedAuthors = [];

            try {
                await retryWithBackoff(async () => {
                    let connection;
                    try {
                        connection = await dbPromise.getConnection();
                        await connection.beginTransaction();

                        // Verify the manuscript exists and belongs to the user using middleware data
                        // Also check if this is a new submission that might not be in DB yet
                        let manuscriptExists = false;
                        
                        if (!submissionData.isNew) {
                            // For existing submissions, verify in database
                            const [manuscriptRecords] = await connection.query(
                                "SELECT revision_id FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ?", 
                                [mainSubmissionId, req.user.email]
                            );
                            manuscriptExists = manuscriptRecords.length > 0;
                        } else {
                            // For new submissions, we trust the middleware
                            manuscriptExists = true;
                        }

                        if (!manuscriptExists) {
                            throw new Error("Manuscript not found or access denied");
                        }

                        // Process logged-in author (corresponding author)
                        if (corresponding_author) {
                            try {
                                const loggedInFullname = [
                                    loggedIn_authors_prefix,
                                    loggedIn_authors_first_name,
                                    loggedIn_authors_last_name,
                                    loggedIn_authors_other_name
                                ].filter(Boolean).join(' ');

                                // Check if author exists
                                const [existingAuthor] = await connection.query(
                                    "SELECT id FROM submission_authors WHERE authors_email = ? AND submission_id = ?",
                                    [corresponding_author, mainSubmissionId]
                                );

                                if (existingAuthor.length === 0) {
                                    const [insertResult] = await connection.query(
                                        `INSERT INTO submission_authors 
                                         (submission_id, authors_fullname, authors_email, orcid_id, 
                                          affiliations, affiliation_country, affiliation_city, 
                                          asfi_membership_id, created_at, last_updated) 
                                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                                        [mainSubmissionId, loggedInFullname, corresponding_author, 
                                         loggedIn_authors_ORCID, loggedIn_affiliation, 
                                         loggedIn_affiliation_country, loggedIn_affiliation_city, 
                                         loggedIn_membership_id]
                                    );

                                    if (insertResult.affectedRows > 0) {
                                        insertedAuthors.push({
                                            email: corresponding_author,
                                            name: loggedInFullname,
                                            type: 'corresponding'
                                        });
                                    } else {
                                        skippedAuthors.push({
                                            email: corresponding_author,
                                            reason: "insertion_failed",
                                            type: 'corresponding'
                                        });
                                    }
                                } else {
                                    skippedAuthors.push({
                                        email: corresponding_author,
                                        reason: "already_exists",
                                        type: 'corresponding'
                                    });
                                }
                            } catch (error) {
                                console.error("Error processing corresponding author:", error);
                                skippedAuthors.push({
                                    email: corresponding_author,
                                    reason: "processing_error",
                                    type: 'corresponding',
                                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
                                });
                            }
                        }

                        // Process additional authors
                        for (let i = 0; i < emails.length; i++) {
                            const authorEmail = emails[i]?.trim();
                            if (!authorEmail) continue;

                            try {
                                const authorFullname = [
                                    authors_prefix?.[i],
                                    authors_first_name?.[i],
                                    authors_last_name?.[i],
                                    authors_other_name?.[i]
                                ].filter(Boolean).join(' ');

                                if (!authorFullname.trim()) {
                                    skippedAuthors.push({
                                        email: authorEmail,
                                        reason: "missing_name",
                                        type: 'additional'
                                    });
                                    continue;
                                }

                                // Check if author exists
                                const [existingAuthor] = await connection.query(
                                    "SELECT id FROM submission_authors WHERE authors_email = ? AND submission_id = ?",
                                    [authorEmail, mainSubmissionId]
                                );

                                if (existingAuthor.length === 0) {
                                    const [insertResult] = await connection.query(
                                        `INSERT INTO submission_authors 
                                         (submission_id, authors_fullname, authors_email, orcid_id, 
                                          affiliations, affiliation_country, affiliation_city, 
                                          asfi_membership_id, created_at, last_updated) 
                                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                                        [mainSubmissionId, authorFullname, authorEmail, 
                                         authors_orcid?.[i], affiliation?.[i], 
                                         affiliation_country?.[i], affiliation_city?.[i], 
                                         membership_id?.[i]]
                                    );

                                    if (insertResult.affectedRows > 0) {
                                        insertedAuthors.push({
                                            email: authorEmail,
                                            name: authorFullname,
                                            type: 'additional'
                                        });
                                    } else {
                                        skippedAuthors.push({
                                            email: authorEmail,
                                            reason: "insertion_failed",
                                            type: 'additional'
                                        });
                                    }
                                } else {
                                    skippedAuthors.push({
                                        email: authorEmail,
                                        reason: "already_exists",
                                        type: 'additional'
                                    });
                                }
                            } catch (error) {
                                console.error(`Error processing author ${authorEmail}:`, error);
                                skippedAuthors.push({
                                    email: authorEmail,
                                    reason: "processing_error",
                                    type: 'additional',
                                    details: process.env.NODE_ENV === 'development' ? error.message : undefined
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

                console.log("Authors processing completed:", {
                    articleId: mainSubmissionId,
                    inserted: insertedAuthors.length,
                    skipped: skippedAuthors.length
                });

                return res.json({ 
                    status: "success",
                    success: "Authors processed successfully",
                    inserted: insertedAuthors,
                    skipped: skippedAuthors,
                    corresponding_author: corresponding_author || null,
                    article_id: mainSubmissionId,
                    submission_status: submissionData.submission?.status || 'draft'
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
                    message: "Failed to process authors",
                    details: process.env.NODE_ENV === 'development' ? dbError.message : "Please try again"
                });
            }

        } catch (error) {
            console.error("System error processing authors:", error);
            return res.status(500).json({ 
                status: "error", 
                error: "System error",
                message: "An unexpected error occurred",
                details: process.env.NODE_ENV === 'development' ? error.message : "Please try again later"
            });
        }
    });
};

module.exports = AddAuthorToPaper;