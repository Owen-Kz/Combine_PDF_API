const db = require("../../routes/db.config")
const isAdminAccount = require("./isAdminAccount")

const VerifyAuthorAccount = async(req,res) =>{
    try{
        const {id, admin} = req.body 
        if(await isAdminAccount(req.user.id)){
        db.query("UPDATE authors_account SET account_status = 'verified' WHERE email = ?", [id], (err, data) =>{
            if(err){
                return res.json({error:err.message})
            }else{
                return res.json({success:"Account Verified"})
            }
        })
    }else{
        return res.json({error:"Not admin"})
    }
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}

module.exports = VerifyAuthorAccount