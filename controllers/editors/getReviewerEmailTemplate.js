const isAdminAccount = require("./isAdminAccount");

const reviewerEmailTemplate =  (req, res) => {
  const { emailFor } = req.body;
const user = req.user.id

  if (user) {
    isAdminAccount(user, (err, isAdmin) => {
      if (err) {
        return res.status(500).json({ error: 'Error checking admin status' });
      }

      if (isAdmin) {
        const query = 'SELECT * FROM `emails_templates` WHERE `invitation_for` = ?';
        db.query(query, [emailFor], (err, results) => {
          if (err) {
            return res.status(500).json({ error: 'Database query failed' });
          }

          if (results.length > 0) {
            res.json({ success: 'Email Exists', emailContent: results[0] });
          } else {
            res.status(404).json({ error: 'Email template not found' });
          }
        });
      } else {
        res.status(403).json({ error: 'Not Chief Editor' });
      }
    });
  } else {
    res.status(400).json({ error: 'User ID is required' });
  }
}


module.exports = reviewerEmailTemplate

