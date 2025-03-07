const express = require("express");
const CombinePDF = require("../external/combinePDF");
const CombineDOCX = require("../external/combineDOC");
const downloadFile = require("../external/downloadFile");
const openfile = require("../external/openFile");
const documentFileFormat = require("../external/otherWords");
const generateArticleId = require("../controllers/generateArticleId");
const uploadArticlePage = require("../controllers/pages/uploadArticlePage");
const submitArticleType = require("../controllers/submitArticleType");
const getUserData = require("../controllers/getUserData");
const uploadSingleFile = require("../controllers/fileUploads/uploadSingleFiles");
const submitTitle = require("../controllers/submitTitle");
const submitAbstract = require("../controllers/submitAbstract");
const submitKeyword = require("../controllers/submitKeyword");
const authorsProfileSearch = require("../controllers/getAuthorsProfile");
const AddAuthorToPaper = require("../controllers/AddAuthorPaper");
const AddReviewerToPaper = require("../controllers/addSuggestedReviewers");
const SubmitDisclosures = require("../controllers/submitDiscolosures");
const verifyAccount = require("../controllers/account/verifyAccount");
const convertFiles = require("../controllers/convertFiles");
const combinedFilesPage = require("../controllers/pages/combineFilesPage");
const downloadExternal = require("../controllers/fileUploads/downloadExternal");
const allSubmissions = require("../controllers/editors/allSubmissions");
const EditorLoggedIn = require("../controllers/editors/loggedIn");
const editorsDashboard = require("../controllers/editors/pages/dashboard");
const EditorLogin = require("../controllers/editors/login");
const ArchivedSubmissions = require("../controllers/editors/allARchivedSubmissions");
const countAcceptedInvitations = require("../controllers/editors/countAcceptedInvitations");
const countrejecteEditorInvitations = require("../controllers/editors/rejectedEditorinvitations");
const countEditorInvitations = require("../controllers/editors/countEditorInvitations");
const authorsPage = require("../controllers/editors/pages/authorsPage");
const getAllAuthors = require("../controllers/editors/authorsList");
const getAuthorsProfileForSearch = require("../controllers/editors/authorsProfileForSearch");
const getAuthorAccount = require("../controllers/editors/authorsProfile");
const authorsProfilePage = require("../controllers/editors/pages/authorsProfilePage");
const editorsMailPage = require("../controllers/editors/pages/mailPage");
const editorInboxPage = require("../controllers/editors/pages/inboxPage");
const editorInvitationsPage = require("../controllers/editors/pages/editorInvitaions");
const archivedPapersPage = require("../controllers/editors/pages/archivedPapers");
const acceptedPapersPage = require("../controllers/editors/pages/acceptedPapersPage");
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
const composeEmailPage = require("../controllers/editors/pages/composeEmailPage");
const allAcceptedSubmissions = require("../controllers/editors/allAcceptedSubmissions");
const viewSubmission = require("../controllers/editors/pages/viewSubmission");
const getSubmisionKeywords = require("../controllers/submission/getKeywords");
const getSubmissionData = require("../controllers/submission/getSubmissionData");
const getSuggetstedReviewers = require("../controllers/submission/getSuggestedReviewers");
const getREviews = require("../controllers/submission/getReviews");
const getSubmissionAuthors = require("../controllers/submission/getAuthors");
const allPreviousSubmissions = require("../controllers/editors/allPreviousSubmissions");
const mySubmissions = require("../controllers/editors/mySubmissions");
const myPreviousSubmissions = require("../controllers/editors/myPreviousSubmissions");
const getInvitations = require("../controllers/editors/articleInvitations");
const viewReview = require("../controllers/editors/reviews/viewReview");
const returnPaperPage = require("../controllers/editors/pages/returnPaperPage");
const revisePaperPage = require("../controllers/editors/pages/revisePaperPage");
const rejectPaperPage = require("../controllers/editors/pages/rejectPaper");
const acceptPaperPage = require("../controllers/editors/pages/acceptPaperPage");
const inviteReviewerPage = require("../controllers/editors/pages/inviteReviewerPage");
const inviteEditorPage = require("../controllers/editors/pages/inviteEditorPage");
const reviewerEmailTemplate = require("../controllers/editors/getReviewerEmailTemplate");
const listOfAuthorsForSuggestions = require("../controllers/editors/lists/listofAuthorsForSuggestion");
const listOfReviewerEmails = require("../controllers/editors/lists/listOfReviewerEmails");
const listofEditorEmails = require("../controllers/editors/lists/listOfEditorEmails");
const InvitationsPage = require("../controllers/editors/pages/invitationsPage");
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
const viewReviewPage = require("../controllers/editors/pages/viewReviewPage");
const VerifyAuthorAccount = require("../controllers/editors/verifyAuthorAccount");
const DeleteAuthorAccount = require("../controllers/editors/deleteAuthorAccount");
const MigrateAccount = require("../controllers/editors/migrateAuthorAccount");
const editorSignUp = require("../controllers/account/editorSignup");
const remindReviewer = require("../controllers/account/invitations/remindReviewers");
const reviewerSignup = require("../controllers/account/reviewerSignup");

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
  
router.post("/external/api/combinePDF", CombinePDF)
router.post("/external/api/combineDOC", CombineDOCX)
router.get("/file", downloadFile)
router.get("/item", openfile)
router.get("/doc", documentFileFormat)


// ArticleSubmission 
router.get("/uploadManuscript",getUserData, uploadArticlePage)

router.post('/generateArticleId', generateArticleId)
router.post("/submitArticleType", getUserData, submitArticleType)
router.post("/uploadSingleFile/:field", getUserData, uploadSingleFile)
router.post("/submitManuscriptTitle", getUserData, submitTitle)
router.post("/submitAbstract", getUserData, submitAbstract)
router.post("/submitKeyword", getUserData, submitKeyword)
router.get("/authorProfileForSearch", getUserData, authorsProfileSearch)
router.post("/addAuthorToPaper", getUserData, AddAuthorToPaper)
router.post("/addReviewerToPaper", getUserData, AddReviewerToPaper )
router.post("/submitDisclosures", getUserData, SubmitDisclosures)
router.get("/getUserInfo", getUserData, (req,res) =>{
  res.json({success:"user", user:req.user})
})
router.get("/verify", verifyAccount)
router.get("/combine", (req,res) =>{
  res.render("loading")
})
router.get("/convertFiles", convertFiles)
router.get("/combineFiles", combinedFilesPage)
router.get("/manuscripts/:fileName", downloadExternal)


router.get("/dashboard", async (req,res) =>{
  res.redirect("https://asfirj.org/dashboard")
})


// For admin 
router.get("/editors", (req,res) =>{
  res.redirect("/editors/dashboard")
})
router.get("/editors/dashboard", EditorLoggedIn, editorsDashboard)
router.post("/editors/editorsLogin", EditorLogin)
router.post("/editors/allsubmissions", EditorLoggedIn, allSubmissions)
router.post("/editors/archivedSubmissions", EditorLoggedIn, ArchivedSubmissions)
router.post("/editors/allPreviousSubmissions", EditorLoggedIn, allPreviousSubmissions)

router.post("/editors/mySubmissions", EditorLoggedIn, mySubmissions)
router.post("/editors/myPreviousSubmissions", EditorLoggedIn,myPreviousSubmissions)




router.get("/editors/countAcceptedEditorInvitations", EditorLoggedIn, countAcceptedInvitations)
router.get("/editors/countRejectedEditorInvitations", EditorLoggedIn, countrejecteEditorInvitations)
router.get("/editors/countTotalEditorInvitations", EditorLoggedIn, countEditorInvitations)




router.get("/editors/countAcceptedReviewerInvitations", EditorLoggedIn, countacceptedReviewerInvitaions)
router.get("/editors/countRejectedReviewerInvitations", EditorLoggedIn, countRejectedReviewerInvitaions)
router.get("/editors/countTotalReviewerInvitations", EditorLoggedIn, counttotalReviewerInvitaions)

router.get("/editors/Authors", EditorLoggedIn, authorsPage)
router.get("/editors/authorsList", EditorLoggedIn, getAllAuthors)
            
router.get("/editors/authorsProfileForSearch", EditorLoggedIn, getAuthorsProfileForSearch, getAuthorAccount)
router.get("/editors/authorProfileDetails", EditorLoggedIn, getAuthorsProfileForSearch)
router.get("/editors/Profile", EditorLoggedIn, authorsProfilePage)
router.get("/editors/Mail", EditorLoggedIn, editorsMailPage)
router.get("/editors/Inbox", EditorLoggedIn, editorInboxPage)
router.get("/editors/EditorInvitations", EditorLoggedIn, editorInvitationsPage)
router.get("/editors/ArchivedPapers", EditorLoggedIn, archivedPapersPage)
router.get("/editors/AcceptedPapers", EditorLoggedIn, acceptedPapersPage)
router.post("/editors/archiveSubmission", EditorLoggedIn, archiveSubmission)

router.get("/editors/backend/editors/countSubmissions", EditorLoggedIn, countSubmissions)
router.get("/editors/backend/editors/countAuthors", EditorLoggedIn, countAuthors)
router.get("/editors/backend/editors/countReviewed", EditorLoggedIn, countReviewed)
router.get("/editors/backend/editors/countEditorInvites", EditorLoggedIn, countEditorInvitations)
router.get("/editors/backend/editors/countAllEditorInvites", EditorLoggedIn, countAllEditorInvites)

router.post("/editors/allAcceptedSubmissions", EditorLoggedIn, allAcceptedSubmissions)

router.get("/editors/view", EditorLoggedIn, viewSubmission)

router.post("/editors/getKeywords", EditorLoggedIn, getSubmisionKeywords)
router.post("/editors/getSubmissionData", getSubmissionData)
router.get("/editors/getSuggestedReviewers", getSuggetstedReviewers)
router.get("/editors/getReviews", getREviews)
router.get("/editors/getAuthors", getSubmissionAuthors)
router.post("/editors/articleinvitations", EditorLoggedIn, getInvitations)
router.post("/editors/viewReview",EditorLoggedIn, viewReview)
router.post("/editors/accounts/verifyUser", EditorLoggedIn, VerifyAuthorAccount)
router.post("/editors/accounts/deleteAuthor", EditorLoggedIn, DeleteAuthorAccount)
router.post("/editors/accounts/migrateAuthor", EditorLoggedIn, MigrateAccount)


// for Emails 
router.get("/editors/emailContent", EditorLoggedIn, emailContent)
router.get("/editors/emailList", EditorLoggedIn, sentEmails)
router.get("/editors/invitationEmailsList", EditorLoggedIn, invitationEmailList)
router.get("/editors/email/getCCEmail", EditorLoggedIn, getCCEmail)
router.get("/editors/email/getBCC", EditorLoggedIn, getBCCEmail)
router.get("/editors/email/getAttachments", EditorLoggedIn, getAttachments)
router.get("/editors/email/setStatus", EditorLoggedIn, SetStatus)
router.get("/editors/email/getEmailSubscribers", EditorLoggedIn, NewsLetterSubscribers)
router.get("/editors/ComposeEmail", EditorLoggedIn, composeEmailPage)

router.get("/editors/returnPaper", EditorLoggedIn, returnPaperPage)
router.get("/editors/revisePaper", EditorLoggedIn, revisePaperPage)
router.get("/editors/rejectPaper", EditorLoggedIn, rejectPaperPage)
router.get("/editors/acceptPaper", EditorLoggedIn, acceptPaperPage)
router.get("/editors/InviteReviewer", EditorLoggedIn, inviteReviewerPage)
router.get("/editors/InviteEditor", EditorLoggedIn, inviteEditorPage)
router.post("/editors/getReviewerEmailTemplate", EditorLoggedIn, reviewerEmailTemplate)
router.get("/editors/listOfAuthorsForSuggestions", EditorLoggedIn, listOfAuthorsForSuggestions)
router.post("/editors/listOfReviewerEmails", EditorLoggedIn, listOfReviewerEmails)
router.post("/editors/listOfEditorEmails", EditorLoggedIn, listofEditorEmails)
router.get("/papers/invitations", InvitationsPage)
router.post("/editors/email/inviteEditor", EditorLoggedIn, inviteEditorEMail)
router.post("/editors/email/InviteReviewer", EditorLoggedIn, inviteReviewerEmail)
router.post("/editors/email/acceptPaper", EditorLoggedIn, AcceptPaper)
router.post("/editors/email/returnPaper", EditorLoggedIn, ReturnPaper)
router.post("/editors/email/revisePaper", EditorLoggedIn, RevisePaper)
router.post("/editors/email/rejectPaper", EditorLoggedIn, RejectPaper)
router.post("/editors/email/bulkEmail", EditorLoggedIn, sendBulkEmail)
router.get("/editors/Reviews", EditorLoggedIn, viewReviewPage)
router.post("/editors/createAccount", editorSignUp)
router.post("/editors/remindReviewer", EditorLoggedIn, remindReviewer)


router.post("/editors/isEditor", EditorLoggedIn, (req,res) =>{
  res.json({success:"Editor", account:req.user})
})
router.get("/editors/signup", (req,res)=>{
  // if(req.cookies.asfirj_userRegistered){
  //   res.redirect("/editors/dashboard")
  // }else{
  const article = req.query.a ? req.query.a : ""
    res.render("editorRegister", {articleId:article})
  // }
})

router.get("/editors/logout", (req,res) =>{
  clearCookie(req,res,'asfirj_userRegistered')
  clearCookie(req,res,'editor_account_type')
  clearCookie(req,res,'editor')
  res.redirect("/editors/dashboard")
})


router.get("/editors/*", async (req,res) =>{
  res.redirect("/editors/dashboard")
}) 


// For reiewers 
router.get("/reviewers/signup/:e", async (req,res)=>{
  if(req.params.e){
  res.render("reviewerSignUp", {email:req.params.e})
  }else{
    // res.redirect("https://asfirj.org/dasboard")
  }
})
router.post("/backend/reviewers/createReviewerAccount", reviewerSignup)


router.get("*", async (req,res) =>{
    res.redirect("https://asfirj.org")
}) 
module.exports = router