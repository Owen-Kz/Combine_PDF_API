const session = require("express-session");
const generateArticleId = require("../generateArticleId");
const findManuscript = require("../utils/findManuscript");
const writeCookie = require("../utils/writeCookie");
const findKeywords = require("../utils/findKeywords");
const findAuthors = require("../utils/findAuthors");
const findReviewers = require("../utils/findReviewers");

const uploadArticlePage = async (req, res) => {
    try {

        let ArticleId;

        const prefix = req.user.prefix
        const firstname = req.user.firstname
        const lastname = req.user.lastname
        const othername = req.user.othername
        const orcid = req.user.orcid_id
        const email = req.user.email
        const discipline = req.user.discipline
        const affiliation = req.user.affiliations
        const affiliation_country = req.user.affiliation_country
        const affiliation_city = req.user.affiliation_city
        const asfi_membership_id = req.user.asfi_membership_id

        if (req.query.a) {
            ArticleId = req.query.a; // If article ID is in query params, use 
            // const cookieOptions = {
            //     expiresIn: new Date(Date.now() + process.env.COOKIE_EXPIRES * 24 * 60 * 60 * 1000),
            //     httpOnly: false
            // }
            // res.cookie("_sessionID", ArticleId, cookieOptions)
            // if (req.cookies._abstract) {
            //     res.clearCookie("_abstract")
            // }
            // res.cookie("_manFile", 0, cookieOptions)
        } else if (req.cookies._sessionID) {
            ArticleId = req.cookies._sessionID; // Retrieve from session
        } else {
            ArticleId = await generateArticleId(req, res); // Generate new ID
            // req.cookies._sessionID = ArticleId; // Store in session
        }
        let currentProcess 

        function renderPlainPage(){
        currentProcess = "saved_for_later"
        console.log(ArticleId)

            res.render("uploadPage", {
                articleId: ArticleId,
                article_id: ArticleId,
                firstname, lastname, othername, prefix,
                affiliation, affiliation_country, affiliation_city,
                orcid, asfi_membership_id,
                email, discipline,
                currentProcess,
            })
        }
        if(req.query.a){
            const ArticleData = await findManuscript(req.query.a,req.cookies._uem)
            const Keywords = await findKeywords(ArticleData.revision_id)
            const submissionAuthors = await findAuthors(ArticleData.revision_id, req.cookies._uem)
            const suggestedReviewers = await findReviewers(ArticleData.revision_id)
            if(ArticleData){
                ArticleId = req.query.a;
                writeCookie(req,res, "_abstract", ArticleData.abstract)
            
            if(req.query.correct){
                const newCorrectionCount = new Number(ArticleData.corrections_count)+1
                const correctionID = `${ArticleData.article_id}.Cr${newCorrectionCount}`
                writeCookie(req,res, "_sessionID", correctionID)
                writeCookie(req,res,"_newCorrectionCount", newCorrectionCount)
            
                currentProcess = "correction_saved"
                writeCookie(req,res, "_process", "correction")
            }else if(req.query.edit){
                currentProcess = "saved_for_later"
                writeCookie(req,res, "_process", "edit")

            }else if(req.query.revise){
                currentProcess = "revision_saved"
             
                const newRevisionCount = new Number(ArticleData.revisions_count) +1
                const revisionID = `${ArticleData.article_id}.R${newRevisionCount}`
                writeCookie(req,res, "_sessionID", revisionID)
                writeCookie(req,res, "_process", "revision")
                writeCookie(req,res,"_newReviseCount", newRevisionCount)

            }else{
                currentProcess = "saved_for_later"
                writeCookie(req,res, "_sessionID", ArticleId)
            }
        res.render("uploadPage", {
            articleId: ArticleData.revision_id,
            firstname, lastname, othername, prefix,
            affiliation, affiliation_country, affiliation_city,
            orcid, asfi_membership_id,
            email, discipline,
            title:ArticleData.title,
            article_discipline: ArticleData.discipline,
            article_type:ArticleData.article_type,
            manuscript_file: ArticleData.manuscript_file,
            tracked_manuscript_file: ArticleData.tracked_manuscript_file,
            coverLetter: ArticleData.cover_letter_file,
            tables:ArticleData.tables,
            figures:ArticleData.figures,
            graphic_abstract: ArticleData.graphic_abstract,
            supplementaryMaterials: ArticleData.supplementary_materials,
            correspondingAuthor: ArticleData.corresponding_authors_email,
            article_id: ArticleData.article_id,
            previousId: ArticleData.article_id,
            status: ArticleData.status,
            Keywords,
            Authors:submissionAuthors,
            suggestedReviewers,
            currentProcess
        })
    }else{
        ArticleId = await generateArticleId(req, res); 
        renderPlainPage()
    }
    }else{
        renderPlainPage()
     
    }
    } catch (error) {
        res.json({ error: error.message })
    }
}


module.exports = uploadArticlePage