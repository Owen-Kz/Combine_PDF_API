const db = require("../routes/db.config");
const dbPromise = require("../routes/dbPromise.config");
const generateArticleId = require("./generateArticleId");
const findAuthors = require("./utils/findAuthors");
const findKeywords = require("./utils/findKeywords");
const findManuscript = require("./utils/findManuscript");
const findReviewers = require("./utils/findReviewers");

// Enhanced retry function for database operations
async function retryOperation(operation, maxRetries = 3, baseDelay = 100) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            // Only retry on specific database errors
            const retryableErrors = [
                'ER_LOCK_DEADLOCK', 
                'ER_DUP_ENTRY',
                'ER_LOCK_WAIT_TIMEOUT',
                'ER_TOO_MANY_CONCURRENT_TRXS'
            ];
            
            if (!retryableErrors.includes(error.code) && error.errno !== 1213) {
                throw error;
            }
            
            console.log(`Database operation failed (${error.code}), retry ${attempt}/${maxRetries}`);
            
            if (attempt < maxRetries) {
                // Exponential backoff with jitter
                const delay = baseDelay * Math.pow(2, attempt - 1);
                const jitter = delay * 0.2 * Math.random();
                await new Promise(resolve => setTimeout(resolve, delay + jitter));
            }
        }
    }
    
    throw lastError;
}

// Helper function to safely get file URL from session data
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

// Helper function to preserve session file data
const preserveSessionFiles = (req, existingFiles = {}) => {
    const {
        manFile = false,
        covFile = false,
        docFile = false,
        manuscript_file = null,
        cover_letter_file = null,
        document_file = null
    } = existingFiles;

    req.session.manuscriptData.manFile = manFile;
    req.session.manuscriptData.covFile = covFile;
    req.session.manuscriptData.docFile = docFile;
    req.session.manuscriptData.manuscript_file = manuscript_file;
    req.session.manuscriptData.cover_letter_file = cover_letter_file;
    req.session.manuscriptData.document_file = document_file;
};

// Helper function to set defaultFiles from article data if not already set by user
const setDefaultFilesFromArticle = (req, articleData) => {
    if (articleData.manuscript_file && !req.session.manuscriptData.manFile) {
        req.session.manuscriptData.manFile = true;
        req.session.manuscriptData.manuscript_file = articleData.manuscript_file;
    }
    
    if (articleData.cover_letter_file && !req.session.manuscriptData.covFile) {
        req.session.manuscriptData.covFile = true;
        req.session.manuscriptData.cover_letter_file = articleData.cover_letter_file;
    }
    
    if (articleData.document_file && !req.session.manuscriptData.docFile) {
        req.session.manuscriptData.docFile = true;
        req.session.manuscriptData.document_file = articleData.document_file;
    }
};

// Helper function to generate revision/correction IDs
const generateRevisionId = (articleData, type, existingId, countField) => {
    if (existingId) {
        console.log(`Using existing ${type} ID:`, existingId);
        return existingId;
    }
    
    const newCount = (articleData[countField] || 0) + 1;
    const prefix = type === 'correction' ? 'Cr' : 'R';
    return `${articleData.article_id}.${prefix}.${newCount}`;
};

const manuscriptDataMiddleware = async (req, res, next) => {
    try {
        // Validate user session
        if (!req.user || !req.user.email) {
            console.error("User not authenticated in manuscript middleware");
            return res.status(401).json({
                error: "Authentication required",
                message: "Please log in to access manuscript features"
            });
        }

        let currentProcess = "saved_for_later";
        let NewRevisionId = "";
        let ArticleId = "";

        // Initialize session data if not exists
        if (!req.session.manuscriptData) {
            req.session.manuscriptData = {};
        }

        console.log("Manuscript middleware - User:", req.user.email);
        console.log("Request query:", req.query);
        console.log("Request params:", req.params);
        
        // Preserve existing session data
        const existingFiles = {
            manFile: req.session.manuscriptData.manFile,
            covFile: req.session.manuscriptData.covFile,
            docFile: req.session.manuscriptData.docFile,
            manuscript_file: req.session.manuscriptData.manuscript_file,
            cover_letter_file: req.session.manuscriptData.cover_letter_file,
            document_file: req.session.manuscriptData.document_file
        };
        
        const existingSessionID = req.session.manuscriptData.sessionID;
        const existingProcess = req.session.manuscriptData.process;
        const existingNewRevisionID = req.session.manuscriptData.new_revisionID;
        
        // For API requests (no specific query params), preserve session and continue
        if (!req.query.a && !req.query.prg && !req.query.correction && !req.query.edit && !req.query.revision) {
            preserveSessionFiles(req, existingFiles);
            req.session.manuscriptData.sessionID = existingSessionID || req.params.a;
            req.session.manuscriptData.process = existingProcess || "new";
            return next();
        }
        
        // Check for ?a=ID in URL (page load with specific article)
        if (req.query.a) {
            console.log("New session with article ID:", req.query.a);
            ArticleId = req.query.a;
            req.params.a = ArticleId;
            req.session.manuscriptData.sessionID = ArticleId;

            // Clear old data but preserve file flags and actual file references
            req.session.manuscriptData.abstract = null;
            req.session.manuscriptData.KeyCount = null;
            req.session.manuscriptData.process = null;

            // Restore file flags and actual file references
            preserveSessionFiles(req, existingFiles);

            // Check if submission exists and is already submitted with retry
            const [data] = await retryOperation(() => 
                dbPromise.query(
                    "SELECT status FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ?",
                    [ArticleId, req.user.email]
                )
            );

            if (data && data.length > 0 && data[0].status === 'submitted') {
                console.log("Manuscript already submitted:", ArticleId);
                return res.render("success", {
                    status: "success",
                    message: "Manuscript Already Submitted",
                    tag: "Duplicate Submission",
                });
            }

            // Fetch article data with retry
            const ArticleData = await retryOperation(() => 
                findManuscript(ArticleId, req.user.email)
            );
            
            if (ArticleData) {
                await processArticleData(req, ArticleData, {
                    currentProcess,
                    NewRevisionId,
                    existingNewRevisionID,
                    existingProcess,
                    query: req.query
                });

                // Update the variables with processed data
                currentProcess = req.current_process;
                NewRevisionId = req.session.manuscriptData.new_revisionID;
                
            } else {
                // If no article data found, generate a new ID with retry
                console.log("No article data found, generating new ID");
                ArticleId = await retryOperation(() => generateArticleId(req, res));
                req.session.manuscriptData.sessionID = ArticleId;
                req.session.manuscriptData.process = "new";
            }
        }
        // Reuse existing session ID (progress save)
        else if (req.params.a && req.query.prg) {
            console.log("Session exists with progress save:", req.params.a);
            ArticleId = req.params.a;

            const ArticleData = await retryOperation(() => 
                findManuscript(ArticleId, req.user.email)
            );
            
            if (ArticleData) {
                await processArticleData(req, ArticleData, {
                    currentProcess,
                    NewRevisionId,
                    existingNewRevisionID,
                    existingProcess,
                    query: req.query
                });

                // Update the variables with processed data
                currentProcess = req.current_process;
                NewRevisionId = req.session.manuscriptData.new_revisionID;
                
            } else {
                // If no article data found but we have a session, handle this case
                console.error("Article data not found for session ID:", ArticleId);
                ArticleId = await retryOperation(() => generateArticleId(req, res));
                req.session.manuscriptData.sessionID = ArticleId;
                req.session.manuscriptData.process = "new";
            }
        }
        // Generate new ID for new submissions
        else {
            console.log("Generating new article ID for new submission");
            ArticleId = await retryOperation(() => generateArticleId(req, res));
            req.params.a = ArticleId;
            req.session.manuscriptData.sessionID = ArticleId;
            req.session.manuscriptData.process = "new";
        }
    
        req.current_process = currentProcess;
        
        // Log final state for debugging
        console.log("Manuscript middleware completed:", {
            articleId: ArticleId,
            process: req.session.manuscriptData.process,
            currentProcess: currentProcess,
            hasManuscript: !!req.session.manuscriptData.manFile,
            hasCoverLetter: !!req.session.manuscriptData.covFile,
            hasDocument: !!req.session.manuscriptData.docFile
        });

        // Save session explicitly to ensure persistence
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return next(err);
            }
            next();
        });
    } catch (error) {
        console.error("Manuscript middleware error:", {
            message: error.message,
            code: error.code,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
        
        // If it's a deadlock, retry the entire middleware once
        if (error.code === 'ER_LOCK_DEADLOCK' || error.errno === 1213) {
            console.log("Deadlock detected in middleware, retrying...");
            await new Promise(resolve => setTimeout(resolve, 200));
            return manuscriptDataMiddleware(req, res, next);
        }
        
        // Send appropriate error response
        if (res.headersSent) {
            return next(error);
        }
        
        res.status(500).json({
            status: "error",
            error: "Middleware Error",
            message: "Unable to process manuscript data",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Helper function to process article data (extracted for better organization)
async function processArticleData(req, ArticleData, options) {
    const { currentProcess, NewRevisionId, existingNewRevisionID, existingProcess, query } = options;
    
    req.session.article_data = ArticleData;

    // Load related data with retry
    const [keywords, submissionAuthors, suggested_reviewers] = await Promise.allSettled([
        retryOperation(() => findKeywords(ArticleData.revision_id)),
        retryOperation(() => findAuthors(ArticleData.revision_id, req.user.email)),
        retryOperation(() => findReviewers(ArticleData.revision_id))
    ]);

    // Handle promise results
    req.keywords = keywords.status === 'fulfilled' ? keywords.value : [];
    req.submissionAuthors = submissionAuthors.status === 'fulfilled' ? submissionAuthors.value : [];
    req.suggested_reviewers = suggested_reviewers.status === 'fulfilled' ? suggested_reviewers.value : [];

    // Log any failed operations
    [keywords, submissionAuthors, suggested_reviewers].forEach((result, index) => {
        if (result.status === 'rejected') {
            console.warn(`Failed to load data for index ${index}:`, result.reason);
        }
    });

    // Update session data
    req.session.manuscriptData.sessionID = ArticleData.revision_id;
    if (ArticleData.abstract) {
        req.session.manuscriptData.abstract = ArticleData.abstract;
    }
    
    // Set default files from article data if not already set by user
    setDefaultFilesFromArticle(req, ArticleData);

    let newCurrentProcess = currentProcess;
    let newNewRevisionId = NewRevisionId;

    // Handle corrections/edits/revisions
    if (query.correction) {
        console.log("Processing correction request");
        newNewRevisionId = generateRevisionId(ArticleData, 'correction', existingNewRevisionID, 'corrections_count');
        req.session.manuscriptData.process = "correction";
        newCurrentProcess = "correction_saved";
        
    } else if (query.edit) {
        console.log("Processing edit request");
        newNewRevisionId = ArticleData.revision_id;
        req.session.manuscriptData.process = "edit";
        newCurrentProcess = "edit_saved";
        
    } else if (query.revision) {
        console.log("Processing revision request");
        newNewRevisionId = generateRevisionId(ArticleData, 'revision', existingNewRevisionID, 'revisions_count');
        req.session.manuscriptData.process = "revision";
        newCurrentProcess = "revision_saved";
        
    } else {
        console.log("Processing regular article view");
        req.session.manuscriptData.process = ArticleData.status === 'submitted' ? 'submitted' : 'edit';
    }

    req.session.manuscriptData.new_revisionID = newNewRevisionId;
    req.current_process = newCurrentProcess;
}

// Export the retry function for use in other modules
module.exports = manuscriptDataMiddleware;
module.exports.retryOperation = retryOperation;
module.exports.getSessionFileUrl = getSessionFileUrl;