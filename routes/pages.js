const express = require("express");
const CombinePDF = require("../external/combinePDF");
const CombineDOCX = require("../external/combineDOC");
const downloadFile = require("../external/downloadFile");
const openfile = require("../external/openFile");

const router = express.Router()
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

router.get("*", async (req,res) =>{
    res.redirect("https://asfirj.org")
})
module.exports = router