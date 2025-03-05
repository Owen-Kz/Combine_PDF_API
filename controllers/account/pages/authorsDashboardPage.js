const authorsDashboardPage = async (req,res) =>{
    try{
        if(req.cookies.asfirj_userRegistered || req.cookies.authorAccount){
            res.render("authorDashboard", {user:req.user})
        }else{
            res.render("authorsLogin")
        }
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}


module.exports = authorsDashboardPage