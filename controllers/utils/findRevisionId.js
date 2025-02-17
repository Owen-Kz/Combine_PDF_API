const db = require("../../routes/db.config")

const findRevisionId = async (id, userEmail) =>{
    try{
        return new Promise((resolve, reject) =>{
            db.query("SELECT revision_id FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ? AND status != 'submitted' ",[id, userEmail], async(err,data) =>{
                if(err){
                    console.log(err)
                    reject(err)
                }else if(data[0]){
                    resolve(data[0].revision_id)
                }else {
                    resolve(null)
                }
            } )
        })

    }catch(error){
        console.log(error)
        return null
    }
}


module.exports = findRevisionId