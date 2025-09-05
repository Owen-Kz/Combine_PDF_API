const db = require("../routes/db.config");
const dbPromise = require("../routes/dbPromise.config");
const generateArticleId = require("./generateArticleId");
const findAuthors = require("./utils/findAuthors");
const findKeywords = require("./utils/findKeywords");
const findManuscript = require("./utils/findManuscript");
const findReviewers = require("./utils/findReviewers");

const manuscriptDataMiddleware = async (req, res, next) => {
  try {
    let currentProcess = "saved_for_later";
    let NewRevisionId = "";
    let ArticleId = "";

    // Initialize session data if not exists
    if (!req.session.manuscriptData) {
      req.session.manuscriptData = {};
    }

    console.log("Request query:", req.query);
    console.log("Request params:", req.params);
    
    // Preserve existing session data for API requests
    const existingManFile = req.session.manuscriptData.manFile;
    const existingCovFile = req.session.manuscriptData.covFile;
    const existingDocFile = req.session.manuscriptData.docFile;
    const existingManuscriptFile = req.session.manuscriptData.manuscript_file;
    const existingCoverLetterFile = req.session.manuscriptData.cover_letter_file;
    const existingDocumentFile = req.session.manuscriptData.document_file;
    const existingSessionID = req.session.manuscriptData.sessionID;
    const existingProcess = req.session.manuscriptData.process;
    const existingNewRevisionID = req.session.manuscriptData.new_revisionID;
    
    // For API requests (no specific query params), preserve session and continue
    if (!req.query.a && !req.query.prg && !req.query.correction && !req.query.edit && !req.query.revision) {
      req.session.manuscriptData.manFile = existingManFile || false;
      req.session.manuscriptData.covFile = existingCovFile || false;
      req.session.manuscriptData.docFile = existingDocFile || false;
      req.session.manuscriptData.sessionID = existingSessionID || req.params.a;
      req.session.manuscriptData.process = existingProcess || "new";
      return next();
    }
    
    // Check for ?a=ID in URL (page load with specific article)
    if (req.query.a) {
      console.log("New session with article ID");
      ArticleId = req.query.a;
      req.params.a = ArticleId;
      req.session.manuscriptData.sessionID = ArticleId;

      // Clear old data but preserve file flags and actual file references
      req.session.manuscriptData.abstract = null;
      req.session.manuscriptData.KeyCount = null;
      req.session.manuscriptData.process = null;

      // Restore file flags and actual file references
      req.session.manuscriptData.manFile = existingManFile;
      req.session.manuscriptData.covFile = existingCovFile;
      req.session.manuscriptData.docFile = existingDocFile;
      req.session.manuscriptData.manuscript_file = existingManuscriptFile;
      req.session.manuscriptData.cover_letter_file = existingCoverLetterFile;
      req.session.manuscriptData.document_file = existingDocumentFile;

      // Check if submission exists and is already submitted
      const [data] = await dbPromise.query(
        "SELECT * FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ?",
        [ArticleId, req.user.email]
      );

      if (data && data.status === 'submitted') {
        console.log("Manuscript already submitted");
        return res.render("success", {
          status: "success",
          message: "Manuscript Already Submitted",
          tag: "Duplicate Submission",
        });
      }

      // Fetch article data
      const ArticleData = await findManuscript(ArticleId, req.user.email);
      
      if (ArticleData) {
        req.session.article_data = ArticleData;
  
        req.keywords = await findKeywords(ArticleData.revision_id);
        req.submissionAuthors = await findAuthors(ArticleData.revision_id, req.user.email);
        req.suggested_reviewers = await findReviewers(ArticleData.revision_id);

        // Update session data - preserve existing flags if they exist
        req.session.manuscriptData.sessionID = ArticleData.revision_id;
        if (ArticleData.abstract) req.session.manuscriptData.abstract = ArticleData.abstract;
        
        // For corrections and revisions, preserve files from original submission
        // ONLY if user hasn't already uploaded new ones during this session
        if (ArticleData.manuscript_file && !req.session.manuscriptData.manFile) {
          req.session.manuscriptData.manFile = true;
          req.session.manuscriptData.manuscript_file = ArticleData.manuscript_file;
        }
        
        if (ArticleData.cover_letter_file && !req.session.manuscriptData.covFile) {
          req.session.manuscriptData.covFile = true;
          req.session.manuscriptData.cover_letter_file = ArticleData.cover_letter_file;
        }
        
        if (ArticleData.document_file && !req.session.manuscriptData.docFile) {
          req.session.manuscriptData.docFile = true;
          req.session.manuscriptData.document_file = ArticleData.document_file;
        }

        // Handle corrections/edits/revisions
        if (req.query.correction) {
          console.log("Processing correction request");
          
          // Only generate new correction ID if we don't already have one
          if (!existingNewRevisionID) {
            const newCorrectionCount = (ArticleData.corrections_count || 0) + 1;
            NewRevisionId = `${ArticleData.article_id}.Cr.${newCorrectionCount}`;
          } else {
            NewRevisionId = existingNewRevisionID;
            console.log("Using existing correction ID:", NewRevisionId);
          }
          
          req.session.manuscriptData.process = "correction";
          currentProcess = "correction_saved";
          
          // For corrections, set default files from original ONLY if not already set by user
          if (!req.session.manuscriptData.manFile && ArticleData.manuscript_file) {
            req.session.manuscriptData.manFile = true;
            req.session.manuscriptData.manuscript_file = ArticleData.manuscript_file;
          }
          if (!req.session.manuscriptData.covFile && ArticleData.cover_letter_file) {
            req.session.manuscriptData.covFile = true;
            req.session.manuscriptData.cover_letter_file = ArticleData.cover_letter_file;
          }
          if (!req.session.manuscriptData.docFile && ArticleData.document_file) {
            req.session.manuscriptData.docFile = true;
            req.session.manuscriptData.document_file = ArticleData.document_file;
          }
          
        } else if (req.query.edit) {
          console.log("Processing edit request");
          NewRevisionId = ArticleData.revision_id;
          req.session.manuscriptData.process = "edit";
          currentProcess = "edit_saved";
          
          // For edits, preserve files unless user has changed them
          if (!req.session.manuscriptData.manFile && ArticleData.manuscript_file) {
            req.session.manuscriptData.manFile = true;
            req.session.manuscriptData.manuscript_file = ArticleData.manuscript_file;
          }
          if (!req.session.manuscriptData.covFile && ArticleData.cover_letter_file) {
            req.session.manuscriptData.covFile = true;
            req.session.manuscriptData.cover_letter_file = ArticleData.cover_letter_file;
          }
          if (!req.session.manuscriptData.docFile && ArticleData.document_file) {
            req.session.manuscriptData.docFile = true;
            req.session.manuscriptData.document_file = ArticleData.document_file;
          }
          
        } else if (req.query.revision) {
          console.log("Processing revision request");
          
          // Only generate new revision ID if we don't already have one
          if (!existingNewRevisionID) {
            const newRevisionCount = (ArticleData.revisions_count || 0) + 1;
            NewRevisionId = `${ArticleData.article_id}.R.${newRevisionCount}`;
          } else {
            NewRevisionId = existingNewRevisionID;
            console.log("Using existing revision ID:", NewRevisionId);
          }
          
          req.session.manuscriptData.process = "revision";
          currentProcess = "revision_saved";
          
          // For revisions, set default files from original ONLY if not already set by user
          if (!req.session.manuscriptData.manFile && ArticleData.manuscript_file) {
            req.session.manuscriptData.manFile = true;
            req.session.manuscriptData.manuscript_file = ArticleData.manuscript_file;
          }
          if (!req.session.manuscriptData.covFile && ArticleData.cover_letter_file) {
            req.session.manuscriptData.covFile = true;
            req.session.manuscriptData.cover_letter_file = ArticleData.cover_letter_file;
          }
          if (!req.session.manuscriptData.docFile && ArticleData.document_file) {
            req.session.manuscriptData.docFile = true;
            req.session.manuscriptData.document_file = ArticleData.document_file;
          }
          
        } else {
          console.log("Processing regular article view");
          // For regular article view, set the process appropriately
          req.session.manuscriptData.process = ArticleData.status === 'submitted' ? 'submitted' : 'edit';
        }

        req.session.manuscriptData.new_revisionID = NewRevisionId;
      } else {
        // If no article data found, generate a new ID
        ArticleId = await generateArticleId(req, res);
        req.session.manuscriptData.sessionID = ArticleId;
        req.session.manuscriptData.process = "new";
      }
    }
    // Reuse existing session ID (progress save)
    else if (req.params.a && req.query.prg) {
      console.log("Session exists with progress save");
      ArticleId = req.params.a;

      const ArticleData = await findManuscript(ArticleId, req.user.email);
      if (ArticleData) {
        req.session.article_data = ArticleData;
  
        req.keywords = await findKeywords(ArticleData.revision_id);
        req.submissionAuthors = await findAuthors(ArticleData.revision_id, req.user.email);
        req.suggested_reviewers = await findReviewers(ArticleData.revision_id);

        // Update session data - preserve existing flags and files
        req.session.manuscriptData.sessionID = ArticleData.revision_id;
        if (ArticleData.abstract) req.session.manuscriptData.abstract = ArticleData.abstract;
        
        // For corrections and revisions, preserve files from original submission
        // unless user has already uploaded new ones
        if (ArticleData.manuscript_file && !req.session.manuscriptData.manFile) {
          req.session.manuscriptData.manFile = true;
          req.session.manuscriptData.manuscript_file = ArticleData.manuscript_file;
        }
        
        if (ArticleData.cover_letter_file && !req.session.manuscriptData.covFile) {
          req.session.manuscriptData.covFile = true;
          req.session.manuscriptData.cover_letter_file = ArticleData.cover_letter_file;
        }
        
        if (ArticleData.document_file && !req.session.manuscriptData.docFile) {
          req.session.manuscriptData.docFile = true;
          req.session.manuscriptData.document_file = ArticleData.document_file;
        }

        // Handle corrections/edits/revisions for progress saves too
        if (req.query.correction) {
          console.log("Processing correction request in progress save");
          
          // Only generate new correction ID if we don't already have one
          if (!existingNewRevisionID) {
            const newCorrectionCount = (ArticleData.corrections_count || 0) + 1;
            NewRevisionId = `${ArticleData.article_id}.Cr.${newCorrectionCount}`;
          } else {
            NewRevisionId = existingNewRevisionID;
            console.log("Using existing correction ID:", NewRevisionId);
          }
          
          req.session.manuscriptData.process = "correction";
          currentProcess = "correction_saved";
          
          // For corrections, set default files from original ONLY if not already set by user
          if (!req.session.manuscriptData.manFile && ArticleData.manuscript_file) {
            req.session.manuscriptData.manFile = true;
            req.session.manuscriptData.manuscript_file = ArticleData.manuscript_file;
          }
          if (!req.session.manuscriptData.covFile && ArticleData.cover_letter_file) {
            req.session.manuscriptData.covFile = true;
            req.session.manuscriptData.cover_letter_file = ArticleData.cover_letter_file;
          }
          if (!req.session.manuscriptData.docFile && ArticleData.document_file) {
            req.session.manuscriptData.docFile = true;
            req.session.manuscriptData.document_file = ArticleData.document_file;
          }
          
        } else if (req.query.edit) {
          console.log("Processing edit request in progress save");
          NewRevisionId = ArticleData.revision_id;
          req.session.manuscriptData.process = "edit";
          currentProcess = "edit_saved";
          
          // For edits, preserve files unless user has changed them
          if (!req.session.manuscriptData.manFile && ArticleData.manuscript_file) {
            req.session.manuscriptData.manFile = true;
            req.session.manuscriptData.manuscript_file = ArticleData.manuscript_file;
          }
          if (!req.session.manuscriptData.covFile && ArticleData.cover_letter_file) {
            req.session.manuscriptData.covFile = true;
            req.session.manuscriptData.cover_letter_file = ArticleData.cover_letter_file;
          }
          if (!req.session.manuscriptData.docFile && ArticleData.document_file) {
            req.session.manuscriptData.docFile = true;
            req.session.manuscriptData.document_file = ArticleData.document_file;
          }
          
        } else if (req.query.revision) {
          console.log("Processing revision request in progress save");
          
          // Only generate new revision ID if we don't already have one
          if (!existingNewRevisionID) {
            const newRevisionCount = (ArticleData.revisions_count || 0) + 1;
            NewRevisionId = `${ArticleData.article_id}.R.${newRevisionCount}`;
          } else {
            NewRevisionId = existingNewRevisionID;
            console.log("Using existing revision ID:", NewRevisionId);
          }
          
          req.session.manuscriptData.process = "revision";
          currentProcess = "revision_saved";
          
          // For revisions, set default files from original ONLY if not already set by user
          if (!req.session.manuscriptData.manFile && ArticleData.manuscript_file) {
            req.session.manuscriptData.manFile = true;
            req.session.manuscriptData.manuscript_file = ArticleData.manuscript_file;
          }
          if (!req.session.manuscriptData.covFile && ArticleData.cover_letter_file) {
            req.session.manuscriptData.covFile = true;
            req.session.manuscriptData.cover_letter_file = ArticleData.cover_letter_file;
          }
          if (!req.session.manuscriptData.docFile && ArticleData.document_file) {
            req.session.manuscriptData.docFile = true;
            req.session.manuscriptData.document_file = ArticleData.document_file;
          }
          
        } else {
          console.log("No specific operation in progress save");
          // Maintain existing process if no specific query param
          req.session.manuscriptData.process = existingProcess || 
                                            (ArticleData.status === 'submitted' ? 'submitted' : 'edit');
        }

        req.session.manuscriptData.new_revisionID = NewRevisionId;
      } else {
        // If no article data found but we have a session, handle this case
        console.error("Article data not found for session ID:", ArticleId);
        ArticleId = await generateArticleId(req, res);
        req.session.manuscriptData.sessionID = ArticleId;
        req.session.manuscriptData.process = "new";
      }
    }
    // Generate new ID for new submissions
    else {
      console.log("Generating new article ID");
      ArticleId = await generateArticleId(req, res);
      req.params.a = ArticleId;
      req.session.manuscriptData.sessionID = ArticleId;
      req.session.manuscriptData.process = "new";
    }
   
    req.current_process = currentProcess;
    // console.log("Final manuscript data:", req.session.manuscriptData);

    // Save session explicitly to ensure persistence
    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      next();
    });
  } catch (error) {
    console.error("Middleware error:", error);
    next(error);
  }
};

module.exports = manuscriptDataMiddleware;