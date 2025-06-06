const db = require("../../routes/db.config")
const isAdminAccount = require("./isAdminAccount")

const allSubmissions = async (req, res) => {
    try {
        if (req.cookies.asfirj_userRegistered) {
            const id = req.user.id;
            const page = req.query.page ? parseInt(req.query.page) : 1;
            const pageSize = 5;
            const offset = (page - 1) * pageSize;
            const searchQuery = req.body.search || '';

            if (await isAdminAccount(id)) {
                let baseQuery = `
                    WITH RankedSubmissions AS (
                        SELECT 
                            s.*,
                            ROW_NUMBER() OVER (
                                PARTITION BY s.article_id 
                                ORDER BY s.revision_id DESC, s.process_start_date DESC
                            ) AS row_num
                        FROM submissions s
                        WHERE s.title != ''
                `;

                let whereClause = '';
                let queryParams = [];

                // Add search conditions if search query exists
                if (searchQuery && searchQuery.length >= 2) {
                    whereClause = ` AND (
                        s.title LIKE ? OR 
                        s.revision_id LIKE ? OR 
                        s.status LIKE ?
                    )`;
                    queryParams.push(
                        `%${searchQuery}%`,
                        `%${searchQuery}%`,
                        `%${searchQuery}%`
                    );
                }

                const finalQuery = `
                    ${baseQuery}
                    ${whereClause}
                    )
                    SELECT *
                    FROM RankedSubmissions
                    WHERE row_num = 1
                    ORDER BY process_start_date DESC
                    LIMIT ? OFFSET ?;
                `;

                // Add pagination parameters
                queryParams.push(pageSize, offset);

                // Get paginated results
                db.query(finalQuery, queryParams, async (error, data) => {
                    if (error) {
                        console.log(error);
                        return res.json({ error: error });
                    }

                    // Get total count for pagination
                    let countQuery = `
                        SELECT COUNT(DISTINCT s.article_id) as total
                        FROM submissions s
                        WHERE s.title != ''
                    ` + whereClause;

                    db.query(countQuery, queryParams.slice(0, -2), (countError, countData) => {
                        if (countError) {
                            console.log(countError);
                            return res.json({ error: countError });
                        }

                        const total = countData[0]?.total || 0;
                        const totalPages = Math.ceil(total / pageSize);

                        return res.json({
                            success: "Admin Account",
                            submissions: data,
                            total,
                            totalPages,
                            currentPage: page
                        });
                    });
                });
            } else {
                console.log("NOT ADMIN");
                return res.json({ error: "Not Admin" });
            }
        } else {
            console.log("user not logged in");
            return res.json({ error: "user not logged in" });
        }
    } catch (error) {
        console.log(error);
        return res.json({ error: error.message });
    }
};

module.exports = allSubmissions;