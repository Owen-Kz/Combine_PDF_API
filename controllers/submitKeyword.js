const db = require("../routes/db.config")
const writeCookie = require("./utils/writeCookie")

const submitKeyword = async (req,res) =>{
    try{
        const correspondingAuthor = req.cookies._uem
        // Check if the manuscript Exists 
        const {keyword} = req.body 
       
        // if(!keyword){
        //     return res.json({error:"All fields are required"})
        // }
        if(keyword && keyword != ""){
    const article_id = req.cookies._sessionID
        // check if the id already exists by another users session 
  
        db.query("SELECT * FROM submission_keywords WHERE article_id = ? AND keyword = ?",[article_id, keyword], async (err, data) =>{
            if(err){
                console.log(err)
                return res.json({error:err})
            }
       
            if(data[0]){
            
                // update the submissoin if it already exists 
                db.query("UPDATE submission_keywords SET keyword =? WHERE article_id = ? AND id = ?", [keyword, article_id, data[0].id], async(err, update) =>{
                    if(err){
                        console.log(err)
                        return res.json({error:err})
                    }else if(update.affectedRows > 0){
                        return res.json({success:"Progress saved"})
                    }else{
                       
                       
                        writeCookie(req,res,"_KeyCount", NewKeycount)
                        return res.json({error:"could not update"})
                    }
                    
                })
            }else{
               db.query("INSERT INTO submission_keywords SET ?", [{keyword:keyword, article_id:article_id}], async(err, insert) =>{
                if(err){
                    console.log(er)
                    return res.json({error:err})
                }else if(insert){
                    return res.json({success:"Keyword Created Successfully"})
                }else{
                    return res.json({error:"Could not create Keyword"})
                }
               })
            }
        })
        }
    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}

module.exports =  submitKeyword