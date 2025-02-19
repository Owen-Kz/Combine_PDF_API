const authorsProfilePage = async (req,res) =>{
    try{
        if(req.cookies.userRegistered){
            res.render("authorsProfile", {user:req.user})
        }else{
            res.render("editorLogin")
        }
    }catch(error){
        console.log(errror)
        return res.json({error:error.message})
    }
}


module.exports = authorsProfilePage