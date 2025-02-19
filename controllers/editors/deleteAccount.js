const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");

const deleteAuthorAccount = async (req, res) => {
    const { id: authorEmail } = req.body;
    const admin = req.session.user_id;

    if (await isAdminAccount(admin) && authorEmail) {
        try {
            // Delete the account from authors_account table
            await db.execute('DELETE FROM `authors_account` WHERE `email` = ?', [authorEmail]);

            return res.json({ success: 'AccountDeletedSuccessfully' });
        } catch (error) {
            return res.status(500).json({ error: 'Could Not Delete Account', message: error.message });
        }
    } else {
        return res.json({
            error: `Could Not Delete Account, You are not an Admin or Invalid Email`,
        });
    }
};

module.exports = deleteAuthorAccount;
