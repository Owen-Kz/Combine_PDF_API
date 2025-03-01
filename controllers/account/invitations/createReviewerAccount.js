const db = require("../../../routes/db.config")

const createReviewerAccount = async (email) =>{
    try{
        db.query("SELECT * FROM authors_account WHERE email = ?", (err, data) =>{
            if(err){
                console.log(err)
                return false
            }
            if(data[0]){
                db.query("UPDATE authors_account SET is_reviewer = 'yes' WHERE email = ? ", async(err, data) =>{
                    if(err){
                        console.log(err)
                        return err
                    }else if(data.affectedRows > 0){
                        console.log("reviewer account created")
                        return true
                    }else{
                        console.log("could not create account")
                        return false
                    }
                })
            }
        })
    }catch(error){
        console.log(error)
        return false
    }
}


module.exports = createReviewerAccount