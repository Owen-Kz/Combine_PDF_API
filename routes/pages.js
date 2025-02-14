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
// const documentFile = require("../external/otherWords");

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


router.get("/dashboard", async (req,res) =>{
  res.redirect("https://asfirj.org/dashboard")
})
router.get("*", async (req,res) =>{
    res.redirect("https://asfirj.org")
}) 
module.exports = router