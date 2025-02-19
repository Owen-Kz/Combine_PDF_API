const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");



const mySubmissions = async (req, res) => {
    const data = req.body;
    const adminId = req.session.user_email;
    
    if (!adminId) {
        return res.status(400).json({ error: "Invalid Parameters" });
    }

    try {
        const isAdmin = await isAdminAccount(req.session.user_id);

        if (isAdmin) {
            // Admin account: Query for submissions
            const query = `
                SELECT * FROM submissions 
                WHERE status != 'saved_for_later' 
                  AND status != 'revision_saved' 
                  AND status != 'returned' 
                  AND title != '' 
                ORDER BY id DESC
            `;
            
            db.execute(query, (err, results) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: 'Admin Account', submissions: results });
            });

        } else {
            // Non-admin user: Check for submissions they were invited to
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
                    results.forEach(row => {
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

                            // Add the submission to the array if it exists
                            if (submissionResults.length > 0) {
                                submissions.push(submissionResults[0]);
                            }
                        });
                    });

                    res.json({ success: 'Admin Account', submissions });
                } else {
                    res.status(404).json({ error: 'No Invites Available' });
                }
            });
        }
    } catch (err) {
        console.error("Error checking admin status:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}


module.exports = mySubmissions;