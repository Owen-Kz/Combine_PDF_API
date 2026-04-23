const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");



const getAuthorAccount = async (req, res) => {
    try {
        // Check if user is logged in
        if (!req.user || !req.user.id) {
            return res.status(401).json({ status: "error", message: "Unauthorized Access" });
        }

        // Check if user is an admin
        const isAdmin = await isAdminAccount(req.user.id);
        if (!isAdmin) {
            return res.status(403).json({ status: "error", message: "Unauthorized Access" });
        }

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

module.exports = getAuthorAccount;
