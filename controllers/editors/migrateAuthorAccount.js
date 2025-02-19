const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");

const MigrateAccount = async (req, res) => {
    const { id: authorEmail } = req.body;
    const admin = req.user.id;

    if (!isAdminAccount(admin) || !authorEmail) {
        return res.json({ error: "Could Not Migrate Account, You are not an Admin" });
    }

    try {
        // Function to execute a database query using Promises
        const queryAsync = (sql, params) => {
            return new Promise((resolve, reject) => {
                db.query(sql, params, (err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results);
                    }
                });
            });
        };

        // Fetch author details
        const authorRows = await queryAsync("SELECT * FROM authors_account WHERE email = ?", [authorEmail]);

        if (authorRows.length === 0) {
            return res.json({ error: "Account Does Not Exist" });
        }

        const author = authorRows[0];

        if (author.account_status !== "verified") {
            return res.json({ error: "Account is not Verified." });
        }

        const { email, password, prefix, firstname, lastname, othername } = author;
        const fullname = `${prefix} ${firstname} ${lastname} ${othername}`.trim();
        const editorialLevel = "sectional_editor";

        // Check if the user is already an editor
        const editorRows = await queryAsync("SELECT * FROM editors WHERE email = ?", [email]);

        if (editorRows.length > 0) {
            return res.json({ error: "This User is already an Editor" });
        }

        // Insert into editors table
        await queryAsync(
            "INSERT INTO editors (email, fullname, password, editorial_level) VALUES (?, ?, ?, ?)",
            [email, fullname, password, editorialLevel]
        );

        // Update author account details
        const yes = "yes";
        await queryAsync(
            "UPDATE authors_account SET is_editor = ?, is_available_for_review = ?, is_reviewer = ? WHERE email = ?",
            [yes, yes, yes, email]
        );

        // Send final response after all operations complete
        res.json({ success: "Account Migration Successful" });
    } catch (error) {
        console.error(error);
        res.json({ error: "An error occurred during the migration process." });
    }
};

module.exports = MigrateAccount;
