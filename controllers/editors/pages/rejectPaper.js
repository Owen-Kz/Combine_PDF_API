const rejectPaperPage = async (req,res) =>{
    try{
        if(req.cookies.asfirj_userRegistered){
            res.render("rejectPaper", {user:req.user})
        }else{
            res.render("editorLogin")
        }
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}


module.exports = rejectPaperPage