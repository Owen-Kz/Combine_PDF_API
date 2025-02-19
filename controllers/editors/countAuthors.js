const db = require("../../routes/db.config");

const countAuthors = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!userId) {
            return res.json({ error: "Invalid Parameters" });
        }

        const query = `SELECT COUNT(*) AS count FROM authors_account`;

        db.query(query, (error, results) => {
            if (error) {
                console.log(error)
                return res.status(500).json({ error: "Database error", message: error.message });
            }

            const count = results[0]?.count || 0;
            return res.json({ success: "CountSuccess", count });
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Server error", message: error.message });
    }
};

module.exports = countAuthors;
