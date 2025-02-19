const db = require("../../routes/db.config")

const getSuggetstedReviewers = async (req, res) => {
    try{
        const {article_id} = req.body

        db.query("SELECT * FROM `suggested_reviewers` WHERE `article_id` = ?", [article_id], (error, results) => {
            if (error) {
                return res.status(500).json({ error: error.message });
            }

            if (results.length > 0) {
                return res.json({ success: "Reviewers Available", suggestedReviewers: results });
            } else {
                return res.json({ success: "No reviewers have been suggested", suggestedReviewers:[] });
            }
        })
    }catch(error){
    console.log(error)
        return res.json({error:error.message})
    }
}


module.exports = getSuggetstedReviewers