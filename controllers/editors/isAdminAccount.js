const db = require("../../routes/db.config")

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