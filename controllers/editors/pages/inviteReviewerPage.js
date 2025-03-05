const inviteReviewerPage = async (req,res) =>{
    try{
        if(req.cookies.asfirj_userRegistered){
            res.render("inviteReviewer", {user:req.user})
        }else{
            res.render("editorLogin")
        }
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}


module.exports = inviteReviewerPage