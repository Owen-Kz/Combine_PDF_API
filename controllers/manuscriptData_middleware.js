// middleware/manuscriptDataMiddleware.js
const SubmissionManager = require("./utils/SubmissionManager");

const manuscriptDataMiddleware = async (req, res, next) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({
                error: "Authentication required",
                message: "Please log in to access manuscript features"
            });
        }

        let submissionData;
        let usedExistingId = false;
        let isCorrectionOrRevision = false;

        // Priority 1: Use existing submission ID from query parameters
        if (req.query.a) {
            console.log("Attempting to load existing submission from query:", req.query.a);
            try {
                c
                if ((req.query.revise || req.query.revision) || req.query.correct || req.query.correction) {
                    console.log(`Processing ${req.query.revise ? 'revision' : 'correction'} for:`, req.query.a);
                    // For corrections/revisions, we need to create a new version but maintain the relationship
                    submissionData = await SubmissionManager.initializeSubmission(req, 'existing-new', req.query.a);
                    isCorrectionOrRevision = true;
                    console.log(`Created ${req.query.revise ? 'revision' : 'correction'} submission:`, submissionData.articleId);
                } else {
                    // Regular existing submission
                    submissionData = await SubmissionManager.initializeSubmission(req, 'existing', req.query.a);
                    usedExistingId = true;
                    console.log("Successfully loaded existing submission:", req.query.a);
                }
            } catch (error) {
                console.log("Failed to load submission from query, will try other methods:", error.message);
                // Don't throw here - try other methods
            }
        }

        // Priority 2: Check if we have a recent submission in session (but not for corrections/revisions)
        if (!submissionData && req.session.articleId && !isCorrectionOrRevision) {
            console.log("Attempting to load submission from session:", req.session.articleId);
            try {
                // Check if the session submission is still a draft
                const sessionSubmission = await SubmissionManager.getSubmissionData(req.session.articleId, req.user.email);
                if (sessionSubmission && sessionSubmission.status === 'draft') {
                    submissionData = await SubmissionManager.initializeSubmission(req, 'existing', req.session.articleId);
                    usedExistingId = true;
                    console.log("Successfully loaded draft submission from session:", req.session.articleId);
                } else {
                    console.log("Session submission is not a draft, ignoring:", req.session.articleId);
                    delete req.session.articleId;
                }
            } catch (error) {
                console.log("Failed to load submission from session:", error.message);
                // Clear invalid session ID
                delete req.session.articleId;
            }
        }

        // Priority 3: Check for user's most recent draft (but not for corrections/revisions)
        if (!submissionData && !isCorrectionOrRevision) {
            console.log("Checking for user drafts...");
            try {
                const userDrafts = await SubmissionManager.getUserDrafts(req.user.email);
                if (userDrafts.length > 0) {
                    // Filter for actual drafts (not submitted/completed)
                    const activeDrafts = userDrafts.filter(draft => 
                        draft.status === 'draft' || draft.status === 'saved'
                    );
                    
                    if (activeDrafts.length > 0) {
                        const mostRecentDraft = activeDrafts[0];
                        console.log("Found user draft, loading:", mostRecentDraft.revision_id);
                        submissionData = await SubmissionManager.initializeSubmission(req, 'existing', mostRecentDraft.revision_id);
                        usedExistingId = true;
                    }
                }
            } catch (error) {
                console.log("Error checking user drafts:", error.message);
            }
        }

        // Priority 4: Create new submission only if no existing ones found
        if (!submissionData) {
            console.log("No existing submissions found, creating new one");
            submissionData = await SubmissionManager.initializeSubmission(req, 'new');
        }

        // Attach submission data to request
        req.submissionData = submissionData;
        req.articleId = submissionData.articleId;

        // Store the article ID in session for future requests (unless it's a correction/revision)
        if (!isCorrectionOrRevision) {
            req.session.articleId = submissionData.articleId;
        } else {
            // For corrections/revisions, we don't want to persist the session
            // as they should start fresh each time
            console.log("Not storing correction/revision in session to prevent reuse");
        }

        console.log("Middleware completed:", {
            articleId: req.articleId,
            isNew: submissionData.isNew,
            usedExisting: usedExistingId,
            isCorrectionOrRevision: isCorrectionOrRevision,
            source: usedExistingId ? 'existing' : 'new'
        });

        next();
    } catch (error) {
        console.error("Manuscript middleware error:", error);
        res.status(500).json({
            status: "error",
            error: "Unable to process manuscript data",
            message: error.message
        });
    }
};

module.exports = manuscriptDataMiddleware;