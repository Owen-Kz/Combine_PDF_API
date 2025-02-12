const db = require("../routes/db.config")

const submitTitle = async (req,res) =>{
    try{
        const correspondingAuthor = req.cookies._uem

        // Check if the manuscript Exists 
        const {manuscript_full_title} = req.body 
        if(!manuscript_full_title){
            return res.json({error:"All fields are required"})
        }
    const article_id = req.cookies._sessionID
        // check if the id already exists by another users session 
  
        db.query("SELECT * FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ?",[article_id, correspondingAuthor], async (err, data) =>{
            if(err){
                console.log(err)
                return res.json({error:err})
            }
       
            if(data[0]){
            
                // update the submissoin if it already exists 
                db.query("UPDATE submissions SET title =? WHERE revision_id = ?", [manuscript_full_title, article_id], async(err, update) =>{
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
                return res.json({error:"Manuscript Does not Exist"})
            }
        })
    
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}

module.exports =  submitTitle