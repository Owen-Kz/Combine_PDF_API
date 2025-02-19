const db = require("../../routes/db.config");



const getAuthorsProfileForSearch = async (req, res) => {
    try {
        // Get email from query parameters
        const { encrypted: email } = req.query;
        if (!email) {
            return res.status(400).json({ status: "error", message: "Invalid Parameters" });
        }

        // Query database
        const query = "SELECT * FROM `authors_account` WHERE `email` = ?";
        db.query(query, [email], (error, results) => {
            if (error) {
                return res.status(500).json({ status: "error", message: error.message });
            }
            if (results.length > 0) {
                return res.json({ status: "success", accountData: results[0] });
            } else {
                return res.json({ status: "error", message: "No account found" });
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "error", message: error.message });
    }
};

module.exports = getAuthorsProfileForSearch;
