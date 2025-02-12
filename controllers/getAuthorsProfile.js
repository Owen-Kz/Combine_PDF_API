const db = require("../routes/db.config")

const authorsProfileSearch  = async (req,res) =>{
    try{
        const encrypted = req.query.encrypted
        db.query("SELECT * FROM `authors_account` WHERE `email`= ?", [encrypted], async (err, data) =>{
           if(err){
            return res.json({error:err})
           } else if(data[0]){
            return res.json({success:"Active account", status:"success", accountData:data[0]})
           }else{
            return res.json({error:"No Data found", status:"error"})
           }
        })
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}


module.exports = authorsProfileSearch