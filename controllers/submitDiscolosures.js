const db = require("../routes/db.config");
const multer = require("multer");
const clearCookie = require("./utils/clearCookie");
const SendNewSubmissionEmail = require("./utils/sendNewSubmissionEmail");
const sendEmailToHandler = require("./utils/SendHandlerEmail");
const CoAuthors = require("./CoAuthors");
const upload = multer();

const SubmitDisclosures = async (req, res) => {
  
    upload.none()(req, res, async (err) => {
        if (err) {
            return res.json({ status: "error", error: "Multer error" });
        }
        try {
            const articleId = req.cookies._sessionID
            const {review_status} = req.body
            db.query("SELECT * FROM submissions WHERE revision_id =?", [articleId], (err, paper) =>{
                if(err){
                    return res.json({error:err})
                }else if(paper[0]){
                    const RecipientEmail = paper[0].corresponding_authors_email
                    const manuscriptTitle = paper[0].title 
                    const manuscriptId = paper[0].revision_id
                    if(!paper[0].manuscript_file || paper[0].manuscript_file === null || paper[0].manuscript_file === ""){
                        return res.json({error:"Upload a Manuscript file to continue"})
                    }

                    if(review_status === "submitted"){
                    SendNewSubmissionEmail(RecipientEmail, manuscriptTitle, manuscriptId)
                    sendEmailToHandler(sendEmailToHandler("submissions@asfirj.org", manuscriptTitle, manuscriptId))
                    CoAuthors(req,res, manuscriptId)
                    
                    }
                }else{
                    return res.json({error:"Paper Not Found"})
                }
            })
 
            db.query("UPDATE submissions SET status = ? WHERE revision_id = ?", [review_status, articleId], async (err, data) =>{
                if(err){
                    return res.json({error:err})
                }
                if(data.affectedRows > 0){
                    if(review_status === "submitted"){
                    clearCookie(req, res, "_sessionID")
                    clearCookie(req, res, "_abstract")
                    clearCookie(req, res, "_manFile")
                    clearCookie(req, res, "__KeyCount")
                    clearCookie(req,res, "_process")
                    return  res.json({success:"Manuscript Saved"})

                    }else{
                      return  res.json({error:"Manuscript Could not be saved"})
                    }
                }else{
                    return res.json({error:"We could not find the manuscript"})
                }
            })
         
        } catch (error) {
            console.error("Error Processing Authors:", error.message);
            return res.json({ status: "error", error: `Error Processing Submission: ${error.message}` });
        }
    });
};

module.exports = SubmitDisclosures;
