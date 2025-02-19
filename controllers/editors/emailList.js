const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");


const sentEmails = (req, res) => {
  const userEmail = req.user.email;
  const id = req.user.id
try{
  if (userEmail) {

        if(isAdminAccount(id)){
    

        const query = 'SELECT * FROM `sent_emails` WHERE `sender` = ? ORDER BY `id` DESC';
        db.query(query, [userEmail], (err, results) => {
          if (err) {
            console.log(err)
            return res.status(500).json({ error: 'Database query failed' });
          }

          if (results.length > 0) {
            res.json({ emails: results });
          } else {
            res.json({ noEmail: [] });
          }
        }); 

      } else {
        res.status(403).json({ error: 'Unauthorized access' });
      }
    
  } else {
    res.status(401).json({ error: 'User not authenticated' });
  }
}catch(error){
    console.log(error)
    return res.status(500).json({ error: error.message });
}
};



module.exports = sentEmails