const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");

const mySubmissions = async (req, res) => {
    const adminId = req.user.email;
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const pageSize = 5;
    const offset = (page - 1) * pageSize;
    const searchQuery = req.body.search || '';

    if (!adminId) {
        return res.status(400).json({ error: "Invalid Parameters" });
    }

    try {
        const isAdmin = await isAdminAccount(req.user.id);

        if (isAdmin) {
            // Admin account: Query for submissions with search
            let query = `
                SELECT * FROM submissions 
                WHERE status NOT IN ('saved_for_later', 'revision_saved', 'returned') 
                AND title != ''
            `;

            let countQuery = `SELECT COUNT(*) as total FROM submissions 
                WHERE status NOT IN ('saved_for_later', 'revision_saved', 'returned') 
                AND title != ''`;
            
            let queryParams = [];
            let countParams = [];

            // Add search conditions if search query exists
            if (searchQuery && searchQuery.length >= 2) {
                query += ` AND (
                    title LIKE ? OR 
                    revision_id LIKE ? OR 
                    status LIKE ?
                )`;
                countQuery += ` AND (
                    title LIKE ? OR 
                    revision_id LIKE ? OR 
                    status LIKE ?
                )`;
                
                const searchParam = `%${searchQuery}%`;
                queryParams.push(searchParam, searchParam, searchParam);
                countParams.push(searchParam, searchParam, searchParam);
            }

            query += ` ORDER BY process_start_date DESC LIMIT ? OFFSET ?`;
            queryParams.push(pageSize, offset);

            // Execute both queries in parallel
            Promise.all([
                new Promise((resolve, reject) => {
                    db.execute(query, queryParams, (err, results) => {
                        if (err) reject(err);
                        else resolve(results);
                    });
                }),
                new Promise((resolve, reject) => {
                    db.execute(countQuery, countParams, (err, results) => {
                        if (err) reject(err);
                        else resolve(results[0].total);
                    });
                })
            ]).then(([submissions, total]) => {
                return res.json({ 
                    success: 'Admin Account', 
                    submissions,
                    total,
                    totalPages: Math.ceil(total / pageSize),
                    currentPage: page
                });
            }).catch(error => {
                console.error(error);
                return res.status(500).json({ error: error.message });
            });

        } else {
            // Non-admin user: Check for submissions they were invited to with search
            let baseInviteQuery = `
                SELECT article_id FROM submitted_for_edit 
                WHERE editor_email = ? 
            `;

            let inviteQueryParams = [adminId];

            // Add search conditions if search query exists
            if (searchQuery && searchQuery.length >= 2) {
                baseInviteQuery += `
                    AND article_id IN (
                        SELECT revision_id FROM submissions 
                        WHERE (
                            title LIKE ? OR 
                            revision_id LIKE ? OR 
                            status LIKE ?
                        )
                    )
                `;
                inviteQueryParams.push(
                    `%${searchQuery}%`,
                    `%${searchQuery}%`,
                    `%${searchQuery}%`
                );
            }

            baseInviteQuery += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
            inviteQueryParams.push(pageSize, offset);

            db.execute(baseInviteQuery, inviteQueryParams, async (err, results) => {
                if (err) {
                    console.log(err);
                    return res.status(500).json({ error: err.message });
                }

                if (results.length > 0) {
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
                        
                        // Get total count for pagination
                        let countQuery = `
                            SELECT COUNT(*) as total FROM submitted_for_edit 
                            WHERE editor_email = ?
                        `;
                        let countParams = [adminId];

                        if (searchQuery && searchQuery.length >= 2) {
                            countQuery += `
                                AND article_id IN (
                                    SELECT revision_id FROM submissions 
                                    WHERE (
                                        title LIKE ? OR 
                                        revision_id LIKE ? OR 
                                        status LIKE ?
                                    )
                                )
                            `;
                            countParams.push(
                                `%${searchQuery}%`,
                                `%${searchQuery}%`,
                                `%${searchQuery}%`
                            );
                        }

                        db.execute(countQuery, countParams, (countErr, countData) => {
                            if (countErr) {
                                console.error(countErr);
                                return res.status(500).json({ error: "Error getting total count" });
                            }

                            const total = countData[0]?.total || 0;
                            const totalPages = Math.ceil(total / pageSize);

                            return res.json({ 
                                success: 'User Account', 
                                submissions,
                                total,
                                totalPages,
                                currentPage: page
                            });
                        });
                    } catch (error) {
                        console.error(error);
                        return res.status(500).json({ error: "Error retrieving submissions" });
                    }
                } else {
                    return res.json({ 
                        success: 'User Account', 
                        submissions: [],
                        total: 0,
                        totalPages: 0,
                        currentPage: page
                    });
                }
            });
        }
    } catch (err) {
        console.error("Error checking admin status:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

module.exports = mySubmissions;
