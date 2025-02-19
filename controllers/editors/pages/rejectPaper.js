const rejectPaperPage = async (req,res) =>{
    try{
        if(req.cookies.userRegistered){
            res.render("rejectPaper", {user:req.user})
        }else{
            res.render("editorLogin")
        }
    }catch(error){
        console.log(errror)
        return res.json({error:error.message})
    }
}


module.exports = rejectPaperPage