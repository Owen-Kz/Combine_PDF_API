const db = require("../../routes/db.config");
const isAdminAccount = require("../editors/isAdminAccount");

const NewsLetterSubscribers = async (req,res) =>{
try{
    
    const userId = req.user.id;
    if (!userId) {
        return res.json({ status:"error", error: "Invalid Parameters" });
    }
    if(isAdminAccount(userId)){
        const query = `SELECT * FROM news_letter_subscribers ORDER BY id DESC`;
        db.query(query, (error, results) => {
            if (error) {
                console.log(error)
                return res.status(500).json({ status:"error", error: "Database error", message: error.message });
            }
            if (results.length > 0) {
                return res.json({ status:"success", success: "emailListFound", emailList: results });
            } else {
                return res.json({ status:"error", error: "NoEmailListFound", emailList: [] });
            }
        });
    }else{
        return res.json({ status:"error", error: "Unauthorized Access", emailList: [] });
    }

}catch(error){
    console.log(error)
    return res.json({status:"error", error:error.message})
}
}


module.exports = NewsLetterSubscribers