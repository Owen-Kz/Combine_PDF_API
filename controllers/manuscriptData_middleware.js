const db = require("../routes/db.config");
const dbPromise = require("../routes/dbPromise.config");
const generateArticleId = require("./generateArticleId");
const findAuthors = require("./utils/findAuthors");
const findKeywords = require("./utils/findKeywords");
const findManuscript = require("./utils/findManuscript");
const findReviewers = require("./utils/findReviewers");

const manuscrsciptDataMiddleWare = async (req, res, next) => {
  try {
    let currentProcess = "saved_for_later";
    let NewRevisionId = "";
    let ArticleId = "";

    // Initialize session data
    if (!req.session.manuscriptData) {
      req.session.manuscriptData = {};
    }
    
    // Check for ?a=ID in URL
    if (req.query.a) {
      ArticleId = req.query.a;
      req.session.articleId = ArticleId;
      req.session.manuscriptData.sessionID = ArticleId;

      // Clear old data
      req.session.manuscriptData.abstract = null;
      req.session.manuscriptData.manFile = null;
      req.session.manuscriptData.KeyCount = null;
      req.session.manuscriptData.process = null;

      // Check if submission exists (async/await version)
      const [data] = await dbPromise.query(
        "SELECT * FROM submissions WHERE revision_id = ? AND status = 'submitted' AND corresponding_authors_email = ?",
        [ArticleId, req.user.email]
      );

      if (data && data.status === "submitted") {
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

        // Update session data
        req.session.manuscriptData.sessionID = ArticleData.revision_id;
        if (ArticleData.abstract) req.session.manuscriptData.abstract = ArticleData.abstract;
        if (ArticleData.manuscript_file) req.session.manuscriptData.manFile = true;
        if (ArticleData.cover_letter_file) req.session.manuscriptData.covFile = true;

        // Handle corrections/edits/revisions
        if (req.query.correct) {
          const newCorrectionCount = (ArticleData.corrections_count || 0) + 1;
          NewRevisionId = `${ArticleData.article_id}.Cr${newCorrectionCount}`;
          req.session.manuscriptData.process = "correction";
          currentProcess = "correction_saved";
        } else if (req.query.edit) {
          NewRevisionId = ArticleData.revision_id;
          req.session.manuscriptData.process = "edit";
        } else if (req.query.revise) {
          const newRevisionCount = (ArticleData.revisions_count || 0) + 1;
          NewRevisionId = `${ArticleData.article_id}.R${newRevisionCount}`;
          req.session.manuscriptData.process = "revision";
          currentProcess = "revision_saved";
        }

        req.session.manuscriptData.new_revisionID = NewRevisionId;
      } else {
        ArticleId = await generateArticleId(req, res);
        req.session.manuscriptData.sessionID = ArticleId;
      }
    }
    // Reuse existing session ID
    else if (req.session.articleId && req.query.prg) {
 
              // Fetch article data
      
 
      ArticleId = req.session.articleId;

            const ArticleData = await findManuscript(ArticleId, req.user.email);
         if (ArticleData) {
        req.session.article_data = ArticleData;
  
        req.keywords = await findKeywords(ArticleData.revision_id);
        req.submissionAuthors = await findAuthors(ArticleData.revision_id, req.user.email);
        req.suggested_reviewers = await findReviewers(ArticleData.revision_id);

        // Update session data
        req.session.manuscriptData.sessionID = ArticleData.revision_id;
        if (ArticleData.abstract) req.session.manuscriptData.abstract = ArticleData.abstract;
        if (ArticleData.manuscript_file) req.session.manuscriptData.manFile = true;
        if (ArticleData.cover_letter_file) req.session.manuscriptData.covFile = true;

        // Handle corrections/edits/revisions
        if (req.query.correct) {
          const newCorrectionCount = (ArticleData.corrections_count || 0) + 1;
          NewRevisionId = `${ArticleData.article_id}.Cr${newCorrectionCount}`;
          req.session.manuscriptData.process = "correction";
          currentProcess = "correction_saved";
        } else if (req.query.edit) {
          NewRevisionId = ArticleData.revision_id;
          req.session.manuscriptData.process = "edit";
        } else if (req.query.revise) {
          const newRevisionCount = (ArticleData.revisions_count || 0) + 1;
          NewRevisionId = `${ArticleData.article_id}.R${newRevisionCount}`;
          req.session.manuscriptData.process = "revision";
          currentProcess = "revision_saved";
        }

        req.session.manuscriptData.new_revisionID = NewRevisionId;
    }
    }
    // Generate new ID
    else {
        console.log("JACK")
      ArticleId = await generateArticleId(req, res);
      req.session.articleId = ArticleId;
    }

   
    req.current_process = currentProcess;
    next(); // Only called once!
  } catch (error) {
    console.error(error);
    next(error); // Forward errors to Express
  }
};

module.exports = manuscrsciptDataMiddleWare