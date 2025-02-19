const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");


const myPreviousSubmissions = async (req, res) => {
  const data = req.body;
  const adminId = req.session.user_email;
  let revisionID = data.revision_id;
  let mainId = revisionID;

  // Remove part after '.R' in revisionID if present
  if (revisionID.includes('.R')) {
    revisionID = revisionID.split('.R')[0];
  }

  if (adminId) {
    const isAdmin = await isAdminAccount(req.user.id);
    
    if (isAdmin) {
      // Admin account: Query submissions
      const query = `
        SELECT * FROM submissions 
        WHERE status != 'saved_for_later' 
        AND status != 'revision_saved' 
        AND status != 'returned' 
        AND article_id = ? 
        AND title != '' 
        ORDER BY id DESC
      `;
      
      db.execute(query, [revisionID], (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        return res.json({ success: 'Admin Account', submissions: results });
      });

    } else {
      // Non-admin: Check for submissions they were invited to
      const queryInvites = `
        SELECT * FROM submitted_for_edit 
        WHERE editor_email = ? 
        ORDER BY id DESC
      `;

      db.execute(queryInvites, [adminId], (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        if (results.length > 0) {
          const submissions = [];

          // Loop through invites and get corresponding submission details
          for (const row of results) {
            const submissionId = row.article_id;
            const querySubmissions = `
              SELECT * FROM submissions 
              WHERE status != 'saved_for_later' 
              AND status != 'revision_saved' 
              AND revision_id = ?
            `;
            
            db.execute(querySubmissions, [submissionId], (err, submissionResults) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }

              // Add the submission to the array
              if (submissionResults.length > 0) {
                submissions.push(submissionResults[0]);
              }
            });
          }

          return res.json({ success: 'Admin Account', submissions: submissions });
        } else {
          return res.status(404).json({ error: 'No Invites Available' });
        }
      });
    }
  } else {
    return res.status(400).json({ error: 'Invalid Parameters' });
  }
}

module.exports = myPreviousSubmissions