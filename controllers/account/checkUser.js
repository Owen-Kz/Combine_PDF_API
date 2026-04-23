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
      // Check in editors table
      const [user] = await dbPromise.query(
        "SELECT email FROM editors WHERE email = ?",
        [email]
      );
      
      return res.json({ 
        exists: user.length > 0,
        type: 'editor'
      });
    }

    return res.status(400).json({ error: "Invalid invitation type" });

  } catch (error) {
    console.error("Error checking user:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = checkUser;