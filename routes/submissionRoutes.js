// routes/submissionRoutes.js
const express = require('express');
const SubmissionManager = require('../controllers/utils/SubmissionManager');
const getUserData = require('../controllers/getUserData');
const manuscriptDataMiddleware = require('../controllers/manuscriptData_middleware');
const uploadSingleFile = require('../controllers/fileUploads/uploadSingleFiles');
const AddAuthorToPaper = require('../controllers/AddAuthorPaper');
const router = express.Router();
const AddReviewerToPaper = require("../controllers/addSuggestedReviewers.js");
const SubmitDisclosures = require('../controllers/submitDiscolosures');
const { isArray } = require('util');
const deleteSubmissionSession = require('../controllers/submissionDrafts.js');

// Step saving endpoints
router.post("/submitArticleType", getUserData, manuscriptDataMiddleware, async (req, res) => {
    try {
        const { article_type, discipline, corresponding_authors_email, previous_manuscript_id, is_women_in_contemporary_science } = req.body;
        const articleId = req.articleId;

        await SubmissionManager.saveStepData(articleId, 'article_type', {
            article_type,
            discipline,
            corresponding_authors_email,
            previous_manuscript_id,
            is_women_in_contemporary_science
        });

        res.json({
            success: true,
            message: "Article type saved successfully",
            articleId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post("/submitManuscriptTitle", getUserData, manuscriptDataMiddleware, async (req, res) => {
    try {
        const { title, corresponding_authors_email } = req.body;
        const articleId = req.articleId;

        await SubmissionManager.saveStepData(articleId, 'title', { title, corresponding_authors_email });

        res.json({
            success: true,
            message: "Title saved successfully",
            articleId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post("/submitAbstract", getUserData, manuscriptDataMiddleware, async (req, res) => {
    try {
        const { abstract, corresponding_authors_email } = req.body;
        const articleId = req.articleId;

        await SubmissionManager.saveStepData(articleId, 'abstract', { abstract, corresponding_authors_email });

        res.json({
            success: true,
            message: "Abstract saved successfully",
            articleId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post("/submitKeyword", getUserData, manuscriptDataMiddleware, async (req, res) => {
    try {
        const { keywords, corresponding_authors_email } = req.body;
        const articleId = req.articleId;
        console.log(req.body)
        await SubmissionManager.saveStepData(articleId, 'keywords', { keywords, corresponding_authors_email });

        res.json({
            success: true,
            message: "Keywords saved successfully",
            articleId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Add other step endpoints similarly...

// Get submission draft
router.get("/submission/:articleId", getUserData, async (req, res) => {
    try {
        const submissionData = await SubmissionManager.getSubmissionData(
            req.params.articleId, 
            req.user.email
        );

        if (!submissionData) {
            return res.status(404).json({
                success: false,
                error: "Submission not found"
            });
        }

        res.json({
            success: true,
            submission: submissionData,
            keywords: await SubmissionManager.getSubmissionKeywords(req.params.articleId),
            authors: await SubmissionManager.getSubmissionAuthors(req.params.articleId),
            reviewers: await SubmissionManager.getSubmissionReviewers(req.params.articleId)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get user drafts
router.get("/drafts", getUserData, async (req, res) => {
    try {
        const drafts = await SubmissionManager.getUserDrafts(req.user.email);
        
        res.json({
            success: true,
            drafts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post("/addAuthorToPaper", getUserData, manuscriptDataMiddleware, AddAuthorToPaper);
router.post("/addReviewerToPaper", getUserData, manuscriptDataMiddleware, AddReviewerToPaper);
router.post("/submitDisclosures", getUserData, manuscriptDataMiddleware, SubmitDisclosures);
// In your routes file
router.post("/uploadSingleFile/:field", getUserData, manuscriptDataMiddleware, uploadSingleFile);
router.get("/submission/:articleId/upload-status", getUserData, manuscriptDataMiddleware, uploadSingleFile.checkUploadStatus);


// Final step 
router.get("/delete/session", getUserData, deleteSubmissionSession)

module.exports = router;