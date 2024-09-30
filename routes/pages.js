const express = require("express");
const CombinePDF = require("../external/combinePDF");

const router = express.Router()
router.use(express.json())

router.post("/y/external/api/combinePDF", CombinePDF)
module.exports = router