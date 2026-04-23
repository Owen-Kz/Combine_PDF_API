const db = require("../../routes/db.config")
const dbPromise = require("../../routes/dbPromise.config")

const isAdminAccount = async (id) =>{
    try{
        return new Promise((resolve, reject) =>{
            db.query("SELECT * FROM editors WHERE id = ? AND (editorial_level = 'editor_in_chief' OR editorial_level = 'editorial_assistant')",[id], async(error, data)=>{
                if(error){
                    console.log(error)
                    reject(false)
                }
                if(data[0]){
                    resolve(true)
                }else{
                    const [isAuthorFirst] = await dbPromise.query("SELECT email FROM authors_account WHERE id = ? LIMIT 1", [id])
                    if(isAuthorFirst.length > 0){
                        // Check editors table 
                        const isAdminEditor = await dbPromise.query("SELECT * FROM editors WHERE email = ? AND (editorial_level = 'editor_in_chief' OR editorial_level = 'editorial_assistant')", [isAuthorFirst.email])
                        if(isAdminEditor.length > 0){
                            resolve(true)
                        }
                    }
                    resolve(false)
                }
            })
        })
      
    }catch(error){
        console.log(error)
        return false
    }
}


module.exports = isAdminAccount