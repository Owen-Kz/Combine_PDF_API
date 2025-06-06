const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");

const ArchivedSubmissions = async (req, res) => {
    try {
        const id = req.user.id;
        const page = req.query.page ? parseInt(req.query.page) : 1;
        const pageSize = 5;
        const offset = (page - 1) * pageSize;
        const searchQuery = req.query.search || '';

        if (await isAdminAccount(id)) {
            let query = `SELECT * FROM archived_submissions WHERE title != ''`;
            let params = [];
            
            if (searchQuery && searchQuery.length >= 2) {
                query += ` AND (title LIKE ? OR revision_id LIKE ? OR status LIKE ?)`;
                params.push(
                    `%${searchQuery}%`,
                    `%${searchQuery}%`,
                    `%${searchQuery}%`
                );
            }
            
            query += ` ORDER BY process_start_date DESC LIMIT ? OFFSET ?`;
            params.push(pageSize, offset);

            db.query(query, params, (error, submissions) => {
                if (error) {
                    console.error(error);
                    return res.status(500).json({ 
                        success: false,
                        error: "Database error" 
                    });
                }

                // Get total count
                let countQuery = `SELECT COUNT(*) as total FROM archived_submissions WHERE title != ''`;
                let countParams = [];
                
                if (searchQuery && searchQuery.length >= 2) {
                    countQuery += ` AND (title LIKE ? OR revision_id LIKE ? OR status LIKE ?)`;
                    countParams.push(
                        `%${searchQuery}%`,
                        `%${searchQuery}%`,
                        `%${searchQuery}%`
                    );
                }

                db.query(countQuery, countParams, (countError, countResult) => {
                    if (countError) {
                        console.error(countError);
                        return res.status(500).json({ 
                            success: false,
                            error: "Count query failed" 
                        });
                    }

                    res.json({
                        success: true,
                        submissions: submissions,
                        total: countResult[0].total,
                        totalPages: Math.ceil(countResult[0].total / pageSize),
                        currentPage: page
                    });
                });
            });
        } else {
            res.status(403).json({ 
                success: false,
                error: "Not authorized" 
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false,
            error: "Server error" 
        });
    }
};
module.exports = ArchivedSubmissions;