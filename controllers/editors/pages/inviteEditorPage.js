const getEmailTemplates = require("../../utils/submissions/getEmailTemplates")
const getSubmisstionDetails = require("../../utils/submissions/getSubmittionDetails")


const inviteEditorPage = async (req,res) =>{
    try{
        if(req.cookies.asfirj_userRegistered){
             const articleId = req.query.a 
            if(!articleId){
               return res.json({error:"Invalid Parameters"})
            }
            const getArticleData = await getSubmisstionDetails(req,res)
            const EmailTemplate = await getEmailTemplates(req,res, "editor_invitation")
          
            if(EmailTemplate.error){
                return res.json({error:EmailTemplate.error})
            }
            res.render("inviteEditor", {user:req.user,  articleData: getArticleData.article, messageBody:JSON.stringify(EmailTemplate.emailContent)})
        }else{
            res.render("editorLogin")
        }
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}


module.exports = inviteEditorPage