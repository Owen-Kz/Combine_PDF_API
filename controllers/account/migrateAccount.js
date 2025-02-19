const db = require("../../routes/db.config");
const isAdminAccount = require("../editors/isAdminAccount");

const migrateAccount =  async (req, res) => {
    const { id: authorEmail } = req.body;  // Extracting email from request body
    const admin = req.user.id;  // Admin's user ID from session

    if (!admin || !authorEmail) {
        return res.status(400).json({ error: "Invalid parameters" });
    }

    try {
        // Check if admin account is valid
        const isAdmin = await isAdminAccount(admin);
        if (!isAdmin) {
            return res.status(403).json({ error: "You are not an Admin" });
        }

        // Fetch author details
        const [authorRows] = await db.promise().query("SELECT * FROM authors_account WHERE email = ?", [authorEmail]);

        if (authorRows.length === 0) {
            return res.status(404).json({ error: "Account Does Not Exist" });
        }

        const author = authorRows[0];
        
        // Check if the account is verified
        if (author.account_status !== "verified") {
            return res.status(400).json({ error: "Account is not Verified" });
        }

        const { password, email, prefix, firstname, lastname, othername } = author;
        const fullname = `${prefix} ${firstname} ${lastname} ${othername}`;
        const editorial_level = "sectional_editor";

        // Check if user is already an editor
        const [editorRows] = await db.promise().query("SELECT * FROM editors WHERE email = ?", [email]);

        if (editorRows.length > 0) {
            return res.status(400).json({ error: "This User is already an Editor" });
        }

        // Insert user as editor
        await db.promise().query(
            "INSERT INTO editors (email, fullname, password, editorial_level) VALUES (?, ?, ?, ?)",
            [email, fullname, password, editorial_level]
        );

        // Update author account to reflect editor status
        await db.promise().query(
            "UPDATE authors_account SET is_editor = ?, is_available_for_review = ?, is_reviewer = ? WHERE email = ?",
            ['yes', 'yes', 'yes', email]
        );

        res.json({ success: "Account Migration Successful" });

    } catch (err) {
        console.error("Error migrating account:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}


module.exports = migrateAccount;