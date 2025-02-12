const { resolve } = require("path")
const db = require("../../routes/db.config")

const findKeywords = (manuscriptID) =>{
    try{
        return new Promise((resolve, reject) =>{
            db.query("SELECT * FROM submission_keywords WHERE article_id = ?",[manuscriptID], async(err,data) =>{
                if(err){
                    console.log(err)
                    reject(err)
                }else if(data[0]){
                    resolve(data)
                }else {
                    resolve([])
                }
            } )
        })
    }catch(error){
        return res.json({error:error.message})
    }
}

module.exports = findKeywords