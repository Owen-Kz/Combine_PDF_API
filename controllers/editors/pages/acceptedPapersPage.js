const acceptedPapersPage = async (req,res) =>{
    try{
        if(req.cookies.asfirj_userRegistered){
            res.render("acceptedPapers", {user:req.user})
        }else{
            res.render("editorLogin")
        }
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}


module.exports = acceptedPapersPage