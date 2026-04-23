const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
// const CombinePDF = require("../external/combinePDF");
const CombineDOCX = require("../external/combineDOC");
const downloadFile = require("../external/downloadFile");
const openfile = require("../external/openFile");
const documentFileFormat = require("../external/otherWords");
const generateArticleId = require("../controllers/generateArticleId");
const uploadArticlePage = require("../controllers/pages/uploadArticlePage");
const getUserData = require("../controllers/getUserData");

const convertFiles = require("../controllers/convertFiles");
const combinedFilesPage = require("../controllers/pages/combineFilesPage");
const downloadExternal = require("../controllers/fileUploads/downloadExternal");
const allSubmissions = require("../controllers/editors/allSubmissions");
const EditorLogin = require("../controllers/editors/login");
const ArchivedSubmissions = require("../controllers/editors/allARchivedSubmissions");
const countAcceptedInvitations = require("../controllers/editors/countAcceptedInvitations");
const countrejecteEditorInvitations = require("../controllers/editors/rejectedEditorinvitations");
const countEditorInvitations = require("../controllers/editors/countEditorInvitations");
const getAllAuthors = require("../controllers/editors/authorsList");
const getAuthorsProfileForSearch = require("../controllers/editors/authorsProfileForSearch");
const getAuthorAccount = require("../controllers/editors/authorsProfile");

const countSubmissions = require("../controllers/editors/countSubmissions");
const countAuthors = require("../controllers/editors/countAuthors");
const countReviewed = require("../controllers/editors/countReviewed");
const countacceptedReviewerInvitaions = require("../controllers/editors/count/countAcceptedReviewerInvitation");
const counttotalReviewerInvitaions = require("../controllers/editors/count/countTotalReviewerInvitations");
const countRejectedReviewerInvitaions = require("../controllers/editors/count/countRejectedReviewerInvitations");
const emailContent = require("../controllers/editors/emailContent");
const sentEmails = require("../controllers/editors/emailList");
const invitationEmailList = require("../controllers/editors/invitationEMailList");
const getCCEmail = require("../controllers/emails/getCC");
const getBCCEmail = require("../controllers/emails/getBCC");
const getAttachments = require("../controllers/emails/getAttachments");
const SetStatus = require("../controllers/emails/setStatus");
const NewsLetterSubscribers = require("../controllers/emails/newsLetterSubscribers");
const allAcceptedSubmissions = require("../controllers/editors/allAcceptedSubmissions");
const getSubmisionKeywords = require("../controllers/submission/getKeywords");
const getSubmissionData = require("../controllers/submission/getSubmissionData");
const getSuggetstedReviewers = require("../controllers/submission/getSuggestedReviewers");
const getReviews = require("../controllers/submission/getReviews");
const getSubmissionAuthors = require("../controllers/submission/getAuthors");
const mySubmissions = require("../controllers/editors/mySubmissions");
const myPreviousSubmissions = require("../controllers/editors/myPreviousSubmissions");
const getInvitations = require("../controllers/editors/articleInvitations");
const viewReview = require("../controllers/editors/reviews/viewReview");
const reviewerEmailTemplate = require("../controllers/editors/getReviewerEmailTemplate");
const listOfAuthorsForSuggestions = require("../controllers/editors/lists/listofAuthorsForSuggestion");
const listOfReviewerEmails = require("../controllers/editors/lists/listOfReviewerEmails");
const listofEditorEmails = require("../controllers/editors/lists/listOfEditorEmails");
const inviteEditorEMail = require("../controllers/account/invitations/sendEditorInvite");
const inviteReviewerEmail = require("../controllers/account/invitations/sendReviewerEmail");
const AcceptPaper = require("../controllers/account/invitations/acceptPaper");
const ReturnPaper = require("../controllers/account/invitations/returnPaper");
const RevisePaper = require("../controllers/account/invitations/revisePaper");
const RejectPaper = require("../controllers/account/invitations/rejectPaper");
const { sendBulkEmail } = require("../controllers/account/invitations/sendBullEmail");
const clearCookie = require("../controllers/utils/clearCookie");
const countAllEditorInvites = require("../controllers/editors/countAllEditorInvites");
const archiveSubmission = require("../controllers/editors/archiveSubmission");
const VerifyAuthorAccount = require("../controllers/editors/verifyAuthorAccount");
const DeleteAuthorAccount = require("../controllers/editors/deleteAuthorAccount");
const MigrateAccount = require("../controllers/editors/migrateAuthorAccount");
const editorSignUp = require("../controllers/account/editorSignup");
const remindReviewer = require("../controllers/account/invitations/remindReviewers");
const reviewerSignup = require("../controllers/account/reviewerSignup");
const manuscrsciptDataMiddleWare = require("../controllers/manuscriptData_middleware");
const { config } = require("dotenv");
const deleteAnnouncement = require("../controllers/editors/announcements/deleteAnnouncement");
const updateAccountData = require("../controllers/account/updateAccountData");
const authorsProfileSearch = require("../controllers/getAuthorsProfile");
const { getEditorById, getEditorsByField, getDisciplinesByField, getAllFields, addEditor, updateEditor, deleteEditor } = require("../controllers/editors/admin/getEditors");
const verifyToken = require("../controllers/auth/verifyToken");
const logout = require("../controllers/auth/logout");
const getDashboardStats = require("../controllers/editors/getDashboardStats");
const countDecisioned = require("../controllers/editors/countDescisioned");
const countArchived = require("../controllers/editors/countArchived");
const getReviewerProfile = require("../controllers/editors/reviews/getReviewerProfile");
const getEditorInvitations = require("../controllers/editors/invitations/getEditorinvitations");
const acceptInvitation = require("../controllers/editors/invitations/acceptInvitation");
const declineInvitation = require("../controllers/editors/invitations/declineInvitation");
const AuthorLoggedIn = require("../controllers/account/AuthorLoggedIn");
const AuthorsLogin = require("../controllers/auth/authors/login");
const sendReviewReminder = require("../controllers/account/invitations/sendReviewerReminder");
const exportReviewPDF = require("../controllers/editors/reviews/exportReviewPDF");
const exportReviewExcel = require("../controllers/editors/reviews/exportReviewExcel");
const getAllCompletedReviews = require("../controllers/editors/reviews/getAllCompletedReviews");
const CombineWordDocuments = require("../external/combinePDF");



  config();

const router = express.Router()
router.use(express.urlencoded({ extended: true }));
router.use(express.json())
// Enable CORS for this router
router.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });
  
  // Define the upload folder path and ensure it is writable
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
router.post("/external/api/combinePDF", CombineWordDocuments)
router.post("/external/api/combineDOC", CombineDOCX)
router.get("/file", downloadFile)
router.get("/item", openfile)
router.get("/doc", documentFileFormat)


// ArticleSubmission 
router.get("/uploadManuscript",getUserData, manuscrsciptDataMiddleWare, uploadArticlePage)

router.post('/generateArticleId', generateArticleId)

router.get("/authorProfileForSearch", AuthorLoggedIn, authorsProfileSearch)


router.post("/updateAccountData", upload.none(), AuthorLoggedIn,  updateAccountData)
router.get("/getUserInfo", getUserData, (req,res) =>{
  res.json({success:"user", user:req.user})
})

router.get("/combine", (req,res) =>{
  res.render("loading")
})
router.get("/convertFiles", convertFiles)
router.get("/combineFiles", combinedFilesPage)
router.get("/manuscripts/:fileName", downloadExternal)


router.get("/dashboard", async (req,res) =>{
  res.redirect(`${process.env.FRONTEND_URL}/dashboard`)
})


// For admin 
router.get("/editors", (req,res) =>{
  res.redirect(`${process.env.FRONTEND_URL}/editors/dashboard`)
})


router.post("/editors/editorsLogin", AuthorsLogin)
router.post("/auth/verify-token", verifyToken);
router.post("/auth/logout", logout);

router.get("/editors/all-submissions", AuthorLoggedIn, allSubmissions)
router.get("/editors/archivedSubmissions", AuthorLoggedIn, ArchivedSubmissions)
router.post("/editors/allPreviousSubmissions", AuthorLoggedIn, myPreviousSubmissions)

router.get("/editors/my-submissions", AuthorLoggedIn, mySubmissions)
router.post("/editors/myPreviousSubmissions", AuthorLoggedIn,myPreviousSubmissions)




router.get("/editors/countAcceptedEditorInvitations", AuthorLoggedIn, countAcceptedInvitations)
router.get("/editors/countRejectedEditorInvitations", AuthorLoggedIn, countrejecteEditorInvitations)
router.get("/editors/countTotalEditorInvitations", AuthorLoggedIn, countEditorInvitations)

// New routes
router.get("/editors/backend/editors/countDecisioned", AuthorLoggedIn, countDecisioned);
router.get("/editors/backend/editors/countArchived", AuthorLoggedIn, countArchived);
router.get("/editors/backend/editors/dashboard-stats", AuthorLoggedIn, getDashboardStats);


router.get("/editors/countAcceptedReviewerInvitations", AuthorLoggedIn, countacceptedReviewerInvitaions)
router.get("/editors/countRejectedReviewerInvitations", AuthorLoggedIn, countRejectedReviewerInvitaions)
router.get("/editors/countTotalReviewerInvitations", AuthorLoggedIn, counttotalReviewerInvitaions)

router.get("/editors/authorsList", AuthorLoggedIn, getAllAuthors)
            
router.get("/editors/authorsProfileForSearch", AuthorLoggedIn, getAuthorsProfileForSearch, getAuthorAccount)
router.get("/editors/authorProfileDetails", AuthorLoggedIn, getAuthorsProfileForSearch)

router.post("/editors/archiveSubmission", AuthorLoggedIn, archiveSubmission)

router.get("/editors/backend/editors/countSubmissions", AuthorLoggedIn, countSubmissions)
router.get("/editors/backend/editors/countAuthors", AuthorLoggedIn, countAuthors)
router.get("/editors/backend/editors/countReviewed", AuthorLoggedIn, countReviewed)
router.get("/editors/backend/editors/countEditorInvites", AuthorLoggedIn, countEditorInvitations)
router.get("/editors/backend/editors/countAllEditorInvites", AuthorLoggedIn, countAllEditorInvites)

router.post("/editors/allAcceptedSubmissions", AuthorLoggedIn, allAcceptedSubmissions)


router.post("/editors/getKeywords", AuthorLoggedIn, getSubmisionKeywords)
router.post("/editors/getSubmissionData", AuthorLoggedIn, getSubmissionData)
router.get("/editors/getSuggestedReviewers", AuthorLoggedIn, getSuggetstedReviewers)
router.get("/editors/getReviews", AuthorLoggedIn, getReviews)
router.get("/editors/reviewer-profile/:email", AuthorLoggedIn, getReviewerProfile)
router.post("/editors/export-review-pdf", AuthorLoggedIn, exportReviewPDF);
router.post("/editors/export-review-excel", AuthorLoggedIn, exportReviewExcel);

router.get("/editors/getAuthors", AuthorLoggedIn,getSubmissionAuthors)
router.post("/editors/articleinvitations", AuthorLoggedIn, getInvitations)
router.post("/editors/viewReview",AuthorLoggedIn, viewReview)
router.get("/editors/all-completed-reviews",AuthorLoggedIn, getAllCompletedReviews)

router.post("/editors/accounts/verifyUser", AuthorLoggedIn, VerifyAuthorAccount)
router.post("/editors/accounts/deleteAuthor", AuthorLoggedIn, DeleteAuthorAccount)
router.post("/editors/accounts/migrateAuthor", AuthorLoggedIn, MigrateAccount)


// Invitations Controls 
// Get invitations
router.get("/editors/invitations", AuthorLoggedIn, getEditorInvitations);

// Accept invitation
router.post("/editors/invitations/accept", AuthorLoggedIn, acceptInvitation);

// Decline invitation
router.post("/editors/invitations/decline", AuthorLoggedIn, declineInvitation);




// for Emails 
router.get("/editors/emailContent", AuthorLoggedIn, emailContent)
router.get("/editors/emailList", AuthorLoggedIn, sentEmails)
router.get("/editors/invitationEmailsList", AuthorLoggedIn, invitationEmailList)
router.get("/editors/email/getCCEmail", AuthorLoggedIn, getCCEmail)
router.get("/editors/email/getBCC", AuthorLoggedIn, getBCCEmail)
router.get("/editors/email/getAttachments", AuthorLoggedIn, getAttachments)
router.get("/editors/email/setStatus", AuthorLoggedIn, SetStatus)
router.get("/editors/email/getEmailSubscribers", AuthorLoggedIn, NewsLetterSubscribers)

router.post("/editors/getReviewerEmailTemplate", AuthorLoggedIn, reviewerEmailTemplate)
router.get("/editors/listOfAuthorsForSuggestions", AuthorLoggedIn, listOfAuthorsForSuggestions)
router.post("/editors/listOfReviewerEmails", AuthorLoggedIn, listOfReviewerEmails)
router.post("/editors/listOfEditorEmails", AuthorLoggedIn, listofEditorEmails)

router.post("/editors/email/inviteEditor", AuthorLoggedIn, inviteEditorEMail)
router.post("/editors/email/InviteReviewer", AuthorLoggedIn, inviteReviewerEmail)
// RESEND INVITATION
router.post("/editors/send-review-reminder", AuthorLoggedIn, sendReviewReminder);

router.post("/editors/email/acceptPaper", AuthorLoggedIn, AcceptPaper)
router.post("/editors/email/returnPaper", AuthorLoggedIn, ReturnPaper)
router.post("/editors/email/revisePaper", AuthorLoggedIn, RevisePaper)
router.post("/editors/email/rejectPaper", AuthorLoggedIn, RejectPaper)
router.post("/editors/email/bulkEmail", AuthorLoggedIn, sendBulkEmail)
router.post("/editors/createAccount", editorSignUp)
router.post("/editors/remindReviewer", AuthorLoggedIn, remindReviewer)
router.get("/editors/getAnnouncements", AuthorLoggedIn, require("../controllers/editors/announcements/getAnnouncements"))
router.post("/editors/uploadAnnouncement", AuthorLoggedIn, require("../controllers/editors/announcements/uploadAnnouncement"))
router.post("/editors/editAnnouncement", AuthorLoggedIn, require("../controllers/editors/announcements/editAnnouncement"))
router.post("/editors/deleteAnnouncement", AuthorLoggedIn, deleteAnnouncement)
router.post("/editors/verifyCode", AuthorLoggedIn, (req, res) => {
  
    const verifyCode = req.body.code;
    if (verifyCode === process.env.VERIFICATION_CODE) {
        res.json({ status: "success", message: "Verification code is correct" });
    } else {
        res.status(400).json({ status: "error", message: "Invalid verification code" });
    }
});

router.post("/editors/isEditor", AuthorLoggedIn, (req,res) =>{
  res.json({success:"Editor", account:req.user})
})


router.get("/editors/logout", (req,res) =>{
  clearCookie(req,res,'asfirj_userRegistered')
  clearCookie(req,res,'editor_account_type')
  clearCookie(req,res,'editor')
  res.redirect("/editors/dashboard")
})

// EDITOR MANAGMENENT 
// Public routes

// API routes for AJAX requests
router.get("/api/editors/by-field", AuthorLoggedIn, getEditorsByField);
router.get("/api/editors/:id", AuthorLoggedIn, getEditorById);
router.get("/api/disciplines/by-field", AuthorLoggedIn, getDisciplinesByField);
router.get("/api/fields", AuthorLoggedIn, getAllFields);

// Protected routes (require authentication)
router.post('/api/editors/add', 
    AuthorLoggedIn,
    addEditor
);

router.post('/api/editors/update', 
    AuthorLoggedIn, 
    updateEditor
);

router.delete('/api/editors/delete/:id', 
    AuthorLoggedIn, 
    deleteEditor
);



// For reiewers 
router.get("/reviewers/signup/:e", async (req,res)=>{
  if(req.params.e){
  res.render("reviewerSignUp", {email:req.params.e})
  }else{
    // res.redirect("https://asfirj.org/dasboard")
  }
})
router.post("/backend/reviewers/createReviewerAccount", reviewerSignup)


router.get("/editors/*", async (req,res) =>{
  res.redirect(`${process.env.FRONTEND_URL}/editors/dashboard`)
}) 
router.get("*", async (req,res) =>{
    res.redirect(`${process.env.FRONTEND_URL}`)
}) 
module.exports = router