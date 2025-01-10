const express = require("express");
const CombinePDF = require("../external/combinePDF");
const CombineDOCX = require("../external/combineDOC");
const downloadFile = require("../external/downloadFile");
const openfile = require("../external/openFile");

const router = express.Router()
router.use(express.json())

router.post("/external/api/combinePDF", CombinePDF)
router.post("/external/api/combineDOC", CombineDOCX)
router.get("/file", downloadFile)
router.get("/item", openfile)

router.get("*", async (req,res) =>{
    res.redirect("https://asfirj.org")
})
module.exports = router