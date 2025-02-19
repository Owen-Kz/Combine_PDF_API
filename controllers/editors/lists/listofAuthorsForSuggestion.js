const db = require("../../../routes/db.config");

const listOfAuthorsForSuggestions = async (req,res) =>{
    try{
        const sessionID = req.query.articleID
        if(!sessionID){
            return res.status(400).json({error:"Invalid Parameters"})
        }

        db.query("SELECT `authors_email` FROM `submission_authors` WHERE `submission_id` = ? ORDER BY `id` ASC",[sessionID], (err, data)=>{
            if(err){
                console.log(err)
                return res.status(500).json({error:err.message})
            }else if(data[0]){
                return res.json({status:"success", authorsList:data})
            }else{
                return res.json({error:"No authors found"})
        } 
        })

    }catch(error){
        return res.json({error:error.message})
    }

}


module.exports = listOfAuthorsForSuggestions