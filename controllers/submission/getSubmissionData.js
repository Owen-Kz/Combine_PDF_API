const db = require("../../routes/db.config")

const getSubmissionData = async (req,res) =>{
try{
    if(req.cookies.asfirj_userRegistered){
    const {id} = req.body 
    if(!id){
        return res.status(400).json({error:"Invalid Parameters"})
    }
    db.query("SELECT * FROM `submissions` WHERE `revision_id` = ?",[id],(error,results) =>{
        if(error){
            return res.status(500).json({error:error.message})
        }
        if(results.length > 0){
            return res.json({success:"Submission Data Found", articles:results[0]})
        }else{
            return res.json({error:"No submission data found"})
        }
    })
}
}catch(error){
    console.log(error)
    return res.json({error:error.message})
}
}


module.exports = getSubmissionData