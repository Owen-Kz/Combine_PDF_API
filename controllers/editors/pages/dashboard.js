const editorsDashboard = async (req,res) =>{
    try{
        if(req.cookies.userRegistered){
            res.render("editorsDashboard", {user:req.user})
        }else{
        res.render("editorLogin")
            
        }
    }catch(error){
        console.log(error)
        res.render("success", {status:"error", tag:"Internal Server Error", message:error.message})
    }
}


module.exports = editorsDashboard