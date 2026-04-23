const db = require("../../routes/db.config");
const sanitizeEmail = require("../utils/sanitizeEmail");

const subscribeToNewsLetter = async (req, res) => {
try{

    const email = sanitizeEmail(req.body.email)
    if (!email) {
        return res.status(400).json({ status: "error", message: "Invalid Parameters" });
    }
    const query = "SELECT * FROM `news_letter_subscribers` WHERE `email` = ?";
    db.query(query, [email], (error, results) => {
        if (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }

        if (results.length > 0) {
            return res.json({ status: "error", message: "You are already subscribed to Our News Letter" });
        } else {
            const query = "INSERT INTO `news_letter_subscribers` (`email`) VALUES(?)";
            db.query(query, [email], (error, results) => {
                if (error) {
                    return res.status(500).json({ status: "error", message: error.message });
                }
                return res.json({ status: "success", message: "Thank you for Subscribing to our news letter" });
            });
        }
    });



}catch(error){
    console.log(error)
    return res.json({error:error.message})
}

}

module.exports = subscribeToNewsLetter