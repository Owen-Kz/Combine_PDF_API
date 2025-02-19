const db = require("../../routes/db.config")

const getREviews = async (req, res) => {
try{
    db.query("SELECT * FROm `reviews` WHERE `article_id` = ? AND `review_status` = 'review_submitted' ORDER BY `id` DESC", [req.query.articleID], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }

        if (results.length > 0) {
            return res.json({ success: "Review Available", reviews: results });
        } else {
            return res.json({ error: "No reviews have been submitted", reviews:[] });
        }
    })
}catch(error){
    console.log(error)
    return res.json({error:error.message})
}
}


module.exports = getREviews