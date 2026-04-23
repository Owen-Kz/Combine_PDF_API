const db = require("../../routes/db.config");

const getCCEmail = async(req,res) =>{
try{

    const emailId = req.query.e
    if(!emailId){
        return res.json({status:"error", error:"Invalid email ID"})
    }
    const query = "SELECT cc_email FROM email_cc WHERE email_id = ? AND cc_email != '' AND cc_email IS NOT NULL";
    db.query(query, [emailId], (error, results) => {
        if (error) {
            return res.status(500).json({ status:"error", error: error.message, cc:[]});
        }
        if (results.length > 0) {
        
            return res.json({status:"success", success: "CC retrieved", cc: results });
        } else {
            return res.json({status:"error", error: "No CC found", cc:[] });
        }
    }
    );

}catch(error){
    console.log(error)
    return res.json({status:"error", error:error.message, cc:[]})
}
}


module.exports = getCCEmail