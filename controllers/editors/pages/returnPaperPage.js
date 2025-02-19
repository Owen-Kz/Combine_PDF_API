const returnPaperPage = async (req,res) =>{
    try{
        if(req.cookies.userRegistered){
            res.render("returnPaper", {user:req.user})
        }else{
            res.render("editorLogin")
        }
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}


module.exports = returnPaperPage