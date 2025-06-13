const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");


const getAllAuthors = async (req, res) => {
    try {
        // Get user ID from session (Assuming session is managed via middleware)
        const userId = req.user?.id;
        if (!userId) {
            return res.status(400).json({ status: "error", message: "Invalid Parameters" });
        }

        // Check if the user is an admin
        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ status: "error", message: "Unauthorized Access" });
        }

        // Query to fetch authors, ordered by ID descending
        const query = "SELECT * FROM `authors_account` ORDER BY `id` DESC";
        db.query(query, (error, results) => {
            if (error) {
                return res.status(500).json({ status: "error", message: error.message });
            }

            // Ensure proper encoding and structure
            const authorsList = results.map(row => {
                Object.keys(row).forEach(key => {
                    row[key] = row[key] !== null ? row[key].toString() : ""; // Convert nulls to empty strings
                });
                return row;
            });

            return res.json({ status: "success", authorsList });
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "error", message: error.message });
    }
};

module.exports = getAllAuthors;
