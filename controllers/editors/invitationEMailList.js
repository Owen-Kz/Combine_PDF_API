const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");


const invitationEmailList =  (req, res) => {
  const userEmail = req.user.email;
try{
  if (userEmail) {


      if (isAdminAccount(req.user.id)) {
        const query = `
          SELECT * FROM sent_emails
          WHERE sender = ? AND email_for = 'To Edit'
          ORDER BY id DESC
        `;
        db.query(query, [userEmail], (err, results) => {
          if (err) {
            return res.status(500).json({ error: 'Database query failed' });
          }

          if (results.length > 0) {
            res.json({ emails: results });
          } else {
            res.json({ noEmail: [] });
          }
        });
      } else {
        res.status(403).json({ error: 'Not an admin' });
      }
    
  } else {
    res.status(400).json({ error: 'User email not found in session' });
  }
}catch(error){
    console.log(error)
    return res.json({status:"error", error:error.message})
}
}

module.exports = invitationEmailList
