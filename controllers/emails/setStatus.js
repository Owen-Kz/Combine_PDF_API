const db = require("../../routes/db.config")

const SetStatus = async (req,res) =>{
    try{
        const emailID = req.query.e_id
        if(!emailID){
            return res.json({error:"Invalid Parameters"})
        }
        const query = `
            SELECT * FROM sent_emails WHERE id = ?
        `
        db.query(query,[emailID],(error,results)=>{
            if(error){
                console.log(error)
                return res.json({error:error.message})
            }
            if(results.length > 0){
                const query = `
                    UPDATE sent_emails SET status = 'Read' WHERE id=?
                `
                db.query(query,[emailID],(error,results)=>{
                    if(error){
                        console.log(error)
                        return res.json({error:error.message})
                    }
                    return res.json({status:"success", success:"Email Read Succesfuly"})
                })
            }else{
                return res.json({error:"No Email Available"})
            }
        })

    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }

}


module.exports = SetStatus