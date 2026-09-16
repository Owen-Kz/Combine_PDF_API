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
const getRelatedSubmissions = require("../controllers/authors/getRelatedSubmissions");
const getCoAuthoredManuscripts = require("../controllers/authors/getCoAuthoredManuscripts");
const getManuscriptsWithDecisions = require("../controllers/authors/getManuscriptsWIthDescisions");
const getDecisionLetter = require("../controllers/authors/getDescisionLetterr");
const generateArticleId = require("../controllers/generateArticleId");
const submitManuscript = require("../controllers/authors/submitManuscript");
const getSubmissionForEdit = require("../controllers/authors/getSubmissionForEdit");
const getDraft = require("../controllers/authors/getDraft");
const submitCorrection = require("../controllers/authors/submitCorrection");
const submitRevision = require("../controllers/authors/submitRevision");
const { saveDraft, uploadFiles, finalizeSubmission } = require("../controllers/authors/submitManuscriptHandlers");
const uploadSingleFile = require("../controllers/fileUploads/uploadSingleFiles");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
config();
const folderPath = path.join(__dirname, "../public");
fs.access(folderPath, fs.constants.W_OK, (err) => {
  if (err) {
    console.log(`The folder '${folderPath}' is not writable:`, err);
  } else {
    console.log(`The folder '${folderPath}' is writable`);
  }
});

// Configure multer storage settings and file size limit
const storage = multer.diskStorage({
  destination: folderPath,
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const profileFile = uniqueSuffix + fileExtension;
    cb(null, profileFile);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Optional: You can filter file types here if needed
    cb(null, true);
  }
});

// Auth routes
router.post("/login", AuthorsLogin);
router.post("/signup", AuthorSignup);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

// Password reset routes
router.post("/forgot-password", forgotPassword);
router.get("/validate-reset-token", validateResetToken);
router.post("/reset-password", resetPassword);
// router.get("/generate-submission-id", async(req,res) =>{
//     try{
//         const user = {
//             email: "bensonmichaeowen@gmail.com",
//             id: 1
//         }
//         req.user = user
//         const Id = await generateArticleId(req,res)
        
//         return res.json({success:"generatedId", id:Id})
//     }catch(error){
//         console.log(error)
//         return res.json({error:error?.message || error})
//     }
// })
// Protected routes (require authentication)
router.use(AuthorLoggedIn); // Middleware to check if user is logged in

// Dashboard routes
router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/recent", getRecentSubmissions);

// Manuscripts routes
router.get("/submissions", getAuthorSubmissions);
router.get("/submissions/:id/related", getRelatedSubmissions);
router.get("/coauthored", getCoAuthoredManuscripts);
router.get("/manuscripts/decisions", getManuscriptsWithDecisions);

// Get decision letter for a specific manuscript
router.get("/manuscripts/:articleId/decision-letter", getDecisionLetter);

// Generate article ID
router.post("/generate-id", generateArticleId);

router.get("/generate-submission-id", async(req,res) =>{
    try{
                const Id = await generateArticleId(req,res)

        
        return res.json({success:"generatedId", id:Id})
    }catch(error){
        console.log(error)
        return res.json({error:error?.message || error})
    }
})

// Submit manuscript (new, correction, revision, draft)
router.post("/submit-manuscript", submitManuscript);
router.post("/submit-correction", submitCorrection);
router.post("/submit-revision", submitRevision);

// Split submission endpoints (legacy endpoints above kept for backward compat)
router.post("/submit-manuscript/draft", saveDraft);
router.post("/submit-manuscript/files", uploadFiles);
router.post("/submit-manuscript/finalize", finalizeSubmission);
router.post("/submit-revision/draft", saveDraft);
router.post("/submit-revision/files", uploadFiles);
router.post("/submit-revision/finalize", finalizeSubmission);
router.post("/submit-correction/draft", saveDraft);
router.post("/submit-correction/files", uploadFiles);
router.post("/submit-correction/finalize", finalizeSubmission);

// Per-file upload used by the portal wizard. Files land in
// useruploads/<destination>/ immediately and only their URL is kept client-side.
// `destination` is read from the multipart body (or the x-destination header).
router.post("/submission/uploadSingleFile/:field", uploadSingleFile);


// Get submission for editing
router.get("/submission/:id", getSubmissionForEdit);

// Get draft
router.get("/draft/:id", getDraft);

module.exports = router;