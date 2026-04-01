// routes/authorsRoutes.js
const express = require("express");
const { config } = require("dotenv");
const dbPromise = require("./dbPromise.config");
const AuthorLoggedIn = require("../controllers/account/AuthorLoggedIn");
const AuthorsLogin = require("../controllers/auth/authors/login");
const AuthorSignup = require("../controllers/auth/authors/signup");
const verifyEmail = require("../controllers/auth/authors/verifyEmail");
const EditorLogin = require("../controllers/editors/login");
const resendVerification = require("../controllers/auth/authors/resentverification");
const forgotPassword = require("../controllers/auth/authors/ForgotPassword");
const validateResetToken = require("../controllers/auth/authors/valifateResetToken");
const resetPassword = require("../controllers/auth/authors/resetPassword");
const getDashboardStats = require("../controllers/authors/getDashboardStats");
const getRecentSubmissions = require("../controllers/authors/getRecentSubmissions");
const getAuthorSubmissions = require("../controllers/authors/getAuthorSubmission");
const getCoAuthoredManuscripts = require("../controllers/authors/getCoAuthoredManuscripts");
const getManuscriptsWithDecisions = require("../controllers/authors/getManuscriptsWIthDescisions");
const getDecisionLetter = require("../controllers/authors/getDescisionLetterr");
const generateArticleId = require("../controllers/generateArticleId");
const submitManuscript = require("../controllers/authors/submitManuscript");
const getSubmissionForEdit = require("../controllers/authors/getSubmissionForEdit");
const getDraft = require("../controllers/authors/getDraft");
const submitCorrection = require("../controllers/authors/submitCorrection");
const submitRevision = require("../controllers/authors/submitRevision");
const router = express.Router();

config();

// Auth routes
router.post("/login", AuthorsLogin);
router.post("/signup", AuthorSignup);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

// Password reset routes
router.post("/forgot-password", forgotPassword);
router.get("/validate-reset-token", validateResetToken);
router.post("/reset-password", resetPassword);

// Protected routes (require authentication)
router.use(AuthorLoggedIn); // Middleware to check if user is logged in

// Dashboard routes
router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/recent", getRecentSubmissions);

// Manuscripts routes
router.get("/submissions", getAuthorSubmissions);
router.get("/coauthored", getCoAuthoredManuscripts);
router.get("/manuscripts/decisions", getManuscriptsWithDecisions);

// Get decision letter for a specific manuscript
router.get("/manuscripts/:articleId/decision-letter", getDecisionLetter);

// Generate article ID
router.post("/generate-id", generateArticleId);

// Submit manuscript (new, correction, revision, draft)
router.post("/submit-manuscript", submitManuscript);
router.post("/submit-correction", submitCorrection);
router.post("/submit-revision", submitRevision);


// Get submission for editing
router.get("/submission/:id", getSubmissionForEdit);

// Get draft
router.get("/draft/:id", getDraft);

module.exports = router;