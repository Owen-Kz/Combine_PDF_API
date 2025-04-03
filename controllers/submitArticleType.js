const db = require("../routes/db.config")
const generateArticleId = require("./generateArticleId")

const submitArticleType = async (req,res) =>{
    
    try{
        const correspondingAuthor = req.cookies._uem

        // Check if the manuscript Exists 
        
        const {article_id, article_type, discipline, previous_manuscript_id, submissionStatus} = req.body 
        
        if(!article_id || !article_type || !discipline || !submissionStatus){
            return res.json({error:`All fields are required ${article_id, article_type, discipline, previous_manuscript_id, submissionStatus}`})
        }
        let articleID;

        const process = req.cookies._process 

        if(process === "correction"){
            
        }
        // check if the id already exists by another users session 
        db.query("SELECT * FROM submissions WHERE revision_id = ? ANd corresponding_authors_email != ?",[article_id, correspondingAuthor], async (err, sessionId) =>{
            if(err){
                console.log(err)
                return res.json({error:err})
            }
            if(sessionId[0]){
                articleID = await generateArticleId(req,res)
            }else{
                articleID = req.cookies._sessionID
            }
            console.log(req.cookies._sessionID)

          
            let revisionsCount = 0 
            let correctionsCount = 0
            if(req.cookies._newCorrectionCount){
                correctionsCount = req.cookies._newCorrectionCount
            }
            if(req.cookies._newReviseCount){
                revisionsCount = req.cookies._newReviseCount
            }


       
        db.query("SELECT * FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ?",[articleID, correspondingAuthor], async (err, data) =>{
            if(err){
                console.log(err)
                return res.json({error:err})
            }
       
            if(data[0]){
            
                // update the submissoin if it already exists 
                db.query("UPDATE submissions SET article_type = ?, discipline = ?, previous_manuscript_id = ?, status = ? WHERE revision_id = ?", [article_type, discipline, previous_manuscript_id,submissionStatus, articleID], async(err, update) =>{
                    if(err){
                        console.log(err)
                        return res.json({error:err})
                    }else if(update.affectedRows > 0){
                        return res.json({success:"Progress saved"})
                    }else{
                        console.log(update.affectedRows)
                        return res.json({error:"could not update"})
                    }
                    
                })
            }else{
                // Create a new submission 
                db.query("INSERT INTO submissions SET ?", {article_id:article_id, revision_id:articleID, article_type:article_type, discipline:discipline, corresponding_authors_email:correspondingAuthor, status:submissionStatus}, async(err, insert) =>{
                    if(err){
                        console.log(err)
                        return res.json({error:err})
                    }else if(insert){
                        db.query("UPDATE submissions SET revisions_count = ? AND corrections_count = ? WHERE article_id = ?AND revision_id != ?", [revisionsCount, correctionsCount, article_id, articleID], (err, data) =>{
                            if(err){
                                console.log(err)
                            }else{
                                console.log(data.affectedRows)
                            }
                        })
                        return res.json({success:"Progress has been saved"})
                    }else{
                        console.log(insert)
                        return res.json({error:"could not save progress"})  
                    }
                })
            
            }
        })
    })
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}

module.exports =  submitArticleType