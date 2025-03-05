const authorsManuscriptsPage = async (req,res) =>{
    try{
        if(req.cookies.asfirj_userRegistered || req.cookies.authorAccount){
            res.render("manuscripts", {user:req.user})
        }else{
            res.render("authorsLogin")
        }
    }catch(error){
        console.log(errror)
        return res.json({error:error.message})
    }
}


module.exports = authorsManuscriptsPage