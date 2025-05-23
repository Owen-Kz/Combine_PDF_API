const db = require("../../../routes/db.config")

const createEditorAccount = async (accountEMail) =>{
    try{
        return new Promise((resolve, reject) =>{
        console.log("Editor creation", accountEMail)
        db.query("SELECT * FROM editors WHERE email = ?", [accountEMail], async (err, data)=>{
            if(err){
                console.log(err)
                resolve(false)
            }
            if(data[0]){
                console.log("account already exists")
                resolve(true)
            }else{
                db.query("SELECT * FROM authors_account WHERE email = ?", [accountEMail], async(err, data) =>{
                    if(err){
                        console.log(err)
                        resolve(false)
                    }
                    if(data[0]){
                        const firstname = data[0].firstname
                        const lastname = data[0].lastname
                        const othername = data[0].othername
                        const prefix = data[0].prefix
                        const fullname = `${prefix} ${firstname} ${othername} ${lastname}`
                        const email = data[0].email 
                        const password = data[0].password
                        db.query("INSERT INTO editors SET ?",[{password:password, email:email, fullname:fullname, editorial_level:sectional_editor }], (err, created) =>{
                            if(err){
                                console.log(err)
                                resolve(false)
                            }
                            if(created.insertId){
                                db.query("UPDATE authors_account SET is_editor = 'yes', is_reviewer = 'yes', is_available_for_review = 'yes' WHERE email = ?", [accountEMail], async (err, update) =>{
                                    if(err){
                                        console.lof(err)
                                        resolve(false)
                                    }
                                    if(update){
                                        console.log("editor account created")
                                        resolve(true)
                                    }
                                })
                            }else{
                                console.log("No insert")
                            }
                        })
                    }else{
                        console.log("no data")
                    }
                })
            }
        })
    })
    }catch(error){
        console.log(error)
        return false
    }
}


module.exports = createEditorAccount