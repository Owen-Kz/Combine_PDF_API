const dbPromise = require("../../../routes/dbPromise.config")
const getEmailTemplates = require("../../utils/submissions/getEmailTemplates")
const getSubmisstionDetails = require("../../utils/submissions/getSubmittionDetails")
const revisePaperPage = async (req,res) =>{
    try{
        if(req.cookies.asfirj_userRegistered){
            const articleId = req.query.a 
            if(!articleId){
               return res.json({error:"Invalid Parameters"})
            }
            const getArticleData = await getSubmisstionDetails(req,res)
           
            const EmailTemplate = await getEmailTemplates(req,res, "revise_manuscript")
          

            if(getArticleData.error){
                return res.json({error:getArticleData.error})
            }
            if(EmailTemplate.error){
                return res.json({error:EmailTemplate.error})
            }
              // get author info 
                        const getAuthor = await dbPromise.query("SELECT * FROM authors_account WHERE email = ?", [getArticleData.article.corresponding_authors_email])
                        
                        let CorrespondingAuthorsName = ""
                        if(getAuthor[0].length > 0){
                      CorrespondingAuthorsName  = `${getAuthor[0][0].prefix} ${getAuthor[0][0].firstname} ${getAuthor[0][0].lastname} ${getAuthor[0][0].othername}`
                        }
            res.render("revisePaper", {user:req.user, articleData: getArticleData.article, messageBody:JSON.stringify(EmailTemplate.emailContent),CorrespondingAuthorsName  })
        }else{
            res.render("editorLogin")
        }
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}


module.exports = revisePaperPage