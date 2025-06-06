const db = require("../routes/db.config");
const multer = require("multer");
const clearCookie = require("./utils/clearCookie");
const SendNewSubmissionEmail = require("./utils/sendNewSubmissionEmail");
const sendEmailToHandler = require("./utils/SendHandlerEmail");
const CoAuthors = require("./CoAuthors");
const dbPromise = require("../routes/dbPromise.config");
const upload = multer();

const SubmitDisclosures = async (req, res) => {
  
    upload.none()(req, res, async (err) => {
        if (err) {
            return res.json({ status: "error", error: "Multer error" });
        }
        try {
            const articleId = req.cookies._sessionID
            const {manuscript_id, review_status, current_process} = req.body
            let is_previous_submission_status = current_process;

// Output: "correction_submitted"
            console.log(req.body)
            db.query("SELECT * FROM submissions WHERE revision_id =?", [articleId], (err, paper) =>{
                if(err){
                    return res.json({error:err})
                }else if(paper[0]){
                    const RecipientEmail = paper[0].corresponding_authors_email
                    const manuscriptTitle = paper[0].title 
                    const manuscriptId = paper[0].revision_id
                    if(!paper[0].manuscript_file || paper[0].manuscript_file === null || paper[0].manuscript_file === ""){
                        return res.json({error:"Upload a Manuscript file to continue"})
                    }else{

                    if(review_status === "submitted"){
                    SendNewSubmissionEmail(RecipientEmail, manuscriptTitle, manuscriptId)
                    sendEmailToHandler(sendEmailToHandler("ajibolaoladejo95@gmail.com", manuscriptTitle, manuscriptId))
                    CoAuthors(req,res, manuscriptId)
                    
                    }
          
            db.query("UPDATE submissions SET status = ? WHERE revision_id = ?", [review_status, articleId], async (err, data) =>{
                if(err){
                    return res.json({error:err})
                }
                if(data.affectedRows > 0){
                    if(review_status === "submitted"){
                    is_previous_submission_status = current_process.replace('saved', 'submitted');

                    await dbPromise.query("UPDATE submissions SET status = ? WHERE article_id = ? AND revision_id != ?", [is_previous_submission_status, manuscript_id, articleId])
                    clearCookie(req, res, "_sessionID")
                    clearCookie(req, res, "_abstract")
                    clearCookie(req, res, "_manFile")
                    clearCookie(req, res, "__KeyCount")
                    clearCookie(req,res, "_process")
                    clearCookie(req,res, "_abstract")
                    clearCookie(req,res, "_covFile")
                    return  res.json({success:"Manuscript Saved"})

                    }else{
                      return  res.json({error:"Manuscript Could not be saved"})
                    }
                }else{
                    return res.json({error:"We could not find the manuscript"})
                }
            })
        }
    }else{
        return res.json({error:"Paper Not Found"})
    }
})

         
        } catch (error) {
            console.error("Error Processing Authors:", error.message);
            return res.json({ status: "error", error: `Error Processing Submission: ${error.message}` });
        }
    });
};

module.exports = SubmitDisclosures;
