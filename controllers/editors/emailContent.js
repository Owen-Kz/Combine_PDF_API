const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");


// API route to fetch sent email by ID
const emailContent =  (req, res) => {
  const userId = req.user.id;
  const emailId = req.query.emailId;
console.log(userId)
  if (userId && emailId) {
    if (isAdminAccount(userId)) {
      const query = 'SELECT * FROM `sent_emails` WHERE `id` = ?';
      db.query(query, [emailId], (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database error', details: err });
        }

        if (result.length > 0) {
          const response = { emails: result[0] };
          return res.json(response);
        } else {
          return res.json({ noEmail: [] });
        }
      });
    } else {
      return res.status(403).json({ error: 'Unauthorized, not an admin' });
    }
  } else {
    return res.status(400).json({ error: 'Missing user ID or email ID' });
  }
};

module.exports = emailContent