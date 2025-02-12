const { resolve } = require("path")
const db = require("../../routes/db.config")

const findManuscript = (manuscriptID, email) =>{
    try{
        return new Promise((resolve, reject) =>{
            db.query("SELECT * FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ? AND status != 'submitted'",[manuscriptID, email], async(err,data) =>{
                if(err){
                    console.log(err)
                    reject(err)
                }else if(data[0]){
                    resolve(data[0])
                }else {
                    resolve([])
                }
            } )
        })
    }catch(error){
        return res.json({error:error.message})
    }
}

module.exports = findManuscript