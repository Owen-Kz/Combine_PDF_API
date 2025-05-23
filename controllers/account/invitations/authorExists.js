const db = require("../../../routes/db.config")

const authorExists = async (email) =>{
    return new Promise((resolve, reject) =>{
        db.query("SELECT * FROM authors_account WHERE email = ?", [email], async (err, data) =>{
            if(err){
                console.log(err)
                reject(err)
            }
            if(data[0]){
                db.query("UPDATE authors_account SET is_reviewer = 'yes', is_available_for_review = 'yes', reviewer_invite_status = 'accepted' WHERE email = ?", [email], (err, update) =>{
                    if(err){
                        console.log(err)
                        reject(err)
                    }
                resolve(true)
                })
            }else{
                resolve(false)
            }
        })
    })
}


module.exports = authorExists