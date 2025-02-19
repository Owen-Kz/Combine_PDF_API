const viewReview = async (req,res) =>{
    try{
        const {a, r} = req.body 
        if(!a || !r){
            return res.status(400).json({error:"Invalid Parameters"});
        }
        const query = "SSELECT * FROM `reviews` WHERE `article_id` = ? AND `reviewer_email` = ?";
        db.query(query, [a, r], (error, results) => {
            if (error) {
                return res.status(500).json({error:error.message});
            }
            if (results.length > 0) {
                return res.json({success:"Review Available", reviewContent: results});
            } else {
                return res.json({error:"No review invitations have been sent", reviewContent:"nothing to show"});
            }
        });
    }catch(error){
        console.error(error);
        return res.status(500).json({error:error.message, reviewContent:"invalid"});
    }
}


module.exports = viewReview