const db = require("../../routes/db.config")
const isAdminAccount = require("./isAdminAccount")

const DeleteAuthorAccount = async(req,res) =>{
    try{
        const {id, admin} = req.body 
        if(await isAdminAccount(req.user.id)){
        db.query("DELETE FROM authors_account WHERE email = ?", [id], (err, data) =>{
            if(err){
                return res.json({error:err.message})
            }else{
                return res.json({success:"Account Deleted"})
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

module.exports = DeleteAuthorAccount