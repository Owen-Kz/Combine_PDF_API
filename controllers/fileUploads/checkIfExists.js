const db = require("../../routes/db.config")

const checkIfFIleExists = async (req,res,field, fieldname,  cookie) =>{
    try{


        if(field != undefined && field != null && field != 'j:null' && (cookie === 0 || !cookie || cookie === undefined)){
            const articleId = req.cookies._sessionID
            const new_revisionID = req.cookies.new_revisionID
         
            db.query(`UPDATE submissions SET ${fieldname} = ? WHERE revision_id = ?`, [field, new_revisionID], async (err, updated) =>{
                if(err){
                    console.log(err)
                    return err
                }
                if(updated.affectedRows > 0){
               
                    return true
                }else{
                    console.log(false)
                   false
                }
            } )

        }else{
            return false
        }
    }catch(error){
        console.log(error)
        return error
    }
}


module.exports = checkIfFIleExists;