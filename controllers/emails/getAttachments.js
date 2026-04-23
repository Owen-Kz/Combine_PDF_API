const db = require("../../routes/db.config");

const getAttachments = async (req, res) => {

try{
    
    const emailId = req.query.e;
    if (!emailId) {
        return res.json({ status:"error", error: "Invalid email ID" });
    }
    const query = "SELECT * FROM email_attachments WHERE email_id = ?";
    db.query(query, [emailId], (error, results) => {
        if (error) {
            return res.status(500).json({ status:"error", error: error.message, attachments:[]});
        }
        if (results.length > 0) {
            return res.json({ status:"success", success: "Attachments retrieved", attachments: results,  });
        } else {
            return res.json({ status:"error", error: "No attachments found",attachments:[] });
        }
    }
    );


}catch(error){
    console.error(error);
    return res.status(500).json({ status:"error", error: "Server error", message: error.message,attachments:[] });
}
}


module.exports = getAttachments