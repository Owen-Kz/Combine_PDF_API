const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");

const mySubmissions = async (req, res) => {
    const adminId = req.user.email;
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const pageSize = 5;
    const offset = (page - 1) * pageSize;

    if (!adminId) {
        return res.status(400).json({ error: "Invalid Parameters" });
    }

    try {
        const isAdmin = await isAdminAccount(req.user.id);

        if (isAdmin) {
            // Admin account: Query for submissions
            const query = `
                SELECT * FROM submissions 
                WHERE status NOT IN ('saved_for_later', 'revision_saved', 'returned') 
                  AND title != '' 
                ORDER BY process_start_date DESC 
                LIMIT ? OFFSET ?`;
            
            db.execute(query, [pageSize, offset], (err, results) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                return res.json({ success: 'Admin Account', submissions: results });
            });

        } else {
            // Non-admin user: Check for submissions they were invited to
            const queryInvites = `
                SELECT article_id FROM submitted_for_edit 
                WHERE editor_email = ? 
                ORDER BY id DESC
            `;
        
            db.execute(queryInvites, [adminId], async (err, results) => {
                if (err) {
                    console.log(err);
                    return res.status(500).json({ error: err.message });
                }

                if (results.length > 0) {
                    // Collect all promises for submissions
                    const submissionPromises = results.map(row => {
                        return new Promise((resolve, reject) => {
                            const querySubmissions = `
                                SELECT * FROM submissions 
                                WHERE status NOT IN ('saved_for_later', 'revision_saved') 
                                  AND revision_id = ?`;

                            db.execute(querySubmissions, [row.article_id], (err, submissionResults) => {
                                if (err) return reject(err);
                                resolve(submissionResults.length > 0 ? submissionResults[0] : null);
                            });
                        });
                    });

                    try {
                        const submissions = (await Promise.all(submissionPromises)).filter(sub => sub !== null);
                        return res.json({ success: 'User Account', submissions });
                    } catch (error) {
                        console.error(error);
                        return res.status(500).json({ error: "Error retrieving submissions" });
                    }
                } else {
                    return res.status(404).json({ error: 'No Invites Available' });
                }
            });
        }
    } catch (err) {
        console.error("Error checking admin status:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

module.exports = mySubmissions;
