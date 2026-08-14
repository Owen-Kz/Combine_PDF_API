const db = require("../../routes/db.config");
const dbPromise = require("../../routes/dbPromise.config");
// controllers/invitations/checkUser.js
const checkUser = async (req, res) => {
  try {
    const { email, type } = req.body;

    if (!email || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (type === 'reviewer') {
      // Check in authors_account
      const [user] = await dbPromise.query(
        "SELECT email, is_reviewer FROM authors_account WHERE email = ?",
        [email]
      );
      
      return res.json({ 
        exists: user.length > 0,
        type: 'reviewer',
        is_reviewer: user.length > 0 ? user[0].is_reviewer === 'yes' : false
      });
      
    } else if (type === 'editor') {
      // An editor invitation can be accepted without the signup form only when
      // the user already has an active editor account (authors_account row with
      // is_editor = 'yes' AND a record in the editors table).
      const [user] = await dbPromise.query(
        "SELECT email, is_editor FROM authors_account WHERE email = ?",
        [email]
      );

      const [editor] = await dbPromise.query(
        "SELECT email FROM editors WHERE email = ?",
        [email]
      );
      
      return res.json({ 
        exists: user.length > 0 && user[0].is_editor === 'yes' && editor.length > 0,
        type: 'editor',
        is_editor: user.length > 0 && user[0].is_editor === 'yes'
      });
    }

    return res.status(400).json({ error: "Invalid invitation type" });

  } catch (error) {
    console.error("Error checking user:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = checkUser;