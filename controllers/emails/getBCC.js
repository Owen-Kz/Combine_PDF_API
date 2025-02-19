const db = require("../../routes/db.config");

const getBCCEmail = async(req,res) =>{
    try{
    
    
        const emailId = req.query.e
        if(!emailId){
            return res.json({status:"error", error:"Invalid email ID"})
        }
        const query = "SELECT bcc_email FROM email_bcc WHERE email_id = ? AND bcc_email != '' AND bcc_email IS NOT NULL";
        db.query(query, [emailId], (error, results) => {
            if (error) {
                return res.status(500).json({ status:"error", error: error.message, bcc:[] });
            }
            if (results.length > 0) {
             
                return res.json({status:"success", success: "BCC retrieved", bcc: results });
            } else {
                return res.json({status:"error", error: "No BCC found", bcc:[] });
            }
        }
        );
    
    }catch(error){
        console.log(error)
        return res.json({status:"error", error:error.message, bcc:[]})
    }
    }
    
    
    module.exports = getBCCEmail