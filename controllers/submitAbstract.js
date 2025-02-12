const db = require("../routes/db.config")
const writeCookie = require("./utils/writeCookie")

const submitAbstract = async (req,res) =>{
    try{
        const correspondingAuthor = req.cookies._uem
        // Check if the manuscript Exists 
        const {abstract} = req.body 
        if(!abstract){
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
                db.query("UPDATE submissions SET abstract =? WHERE revision_id = ?", [abstract, article_id], async(err, update) =>{
                    if(err){
                        console.log(err)
                        return res.json({error:err})
                    }else if(update.affectedRows > 0){
                        const cookieOptions = {
                            expiresIn: new Date(Date.now() + process.env.COOKIE_EXPIRES * 24 * 60 * 60 * 1000),
                            httpOnly: false,
                            sameSite: false,
                            }
                            res.cookie("_abstract", abstract, cookieOptions)

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

module.exports =  submitAbstract