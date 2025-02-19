const db = require("../../../routes/db.config");

const viewReview = async (req,res) =>{
    try{
    
        const {a, r} = req.body 
        if(!a || !r){
            return res.status(400).json({error:"error", message:"Invalid Parameters"});
        }
        const query = "SELECT * FROM `reviews` WHERE `article_id` = ? AND `reviewer_email` = ?";
        db.query(query, [a, r], (error, results) => {
            if (error) {
                console.log(error)
                return res.status(500).json({error:"error", message:error.message});
            }
            if (results.length > 0) {
                return res.json({success:"Review Available", reviewContent: results});
            } else {
                return res.json({error:"error", message:"No review invitations have been sent", reviewContent:"nothing to show"});
            }
        });
    }catch(error){
        console.error(error);
        return res.status(500).json({error:"error", message:error.message, reviewContent:"invalid"});
    }
}


module.exports = viewReview