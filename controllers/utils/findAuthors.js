const { resolve } = require("path")
const db = require("../../routes/db.config")

const findAuthors = (manuscriptID, email) =>{
    try{
        return new Promise((resolve, reject) =>{
            db.query("SELECT * FROM submission_authors WHERE submission_id = ? AND authors_email != ?",[manuscriptID, email], async(err,data) =>{
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

module.exports = findAuthors