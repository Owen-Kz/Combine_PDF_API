// backend/controllers/author/getCoAuthoredManuscripts.js
const db = require("../../routes/db.config");

const getCoAuthoredManuscripts = async (req, res) => {
    try {
        const userEmail = req.user.email; // From auth middleware
        if (!userEmail) {
            console.log("User email required");
            return res.status(400).json({ 
                status: "error", 
                message: "User email not found" 
            });
        }

        // Get pagination and filter parameters from query
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        const sortBy = req.query.sortBy || 'id';
        const sortOrder = req.query.sortOrder || 'DESC';

        // First get all submissions where user is a co-author (in submission_authors table)
        const [coAuthorEntries] = await db.promise().query(
            `SELECT submission_id 
             FROM submission_authors 
             WHERE authors_email = ?`,
            [userEmail]
        );

        if (coAuthorEntries.length === 0) {
            return res.json({
                status: "success",
                manuscripts: [],
                pagination: {
                    currentPage: page,
                    totalPages: 0,
                    totalCount: 0,
                    limit: limit
                }
            });
        }

        // Extract submission IDs
        const submissionIds = coAuthorEntries.map(entry => entry.submission_id);
        
        // Build WHERE clause for search and filter
        let whereConditions = [
            's.revision_id IN (?)',
            's.corresponding_authors_email != ?',
            's.status != "saved_for_later"'
        ];
        let queryParams = [submissionIds, userEmail];

        // Add search condition
        if (search) {
            whereConditions.push('(s.title LIKE ? OR s.revision_id LIKE ? OR s.abstract LIKE ?)');
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        // Add status filter
        if (status !== 'all') {
            whereConditions.push('s.status = ?');
            queryParams.push(status);
        }

        const whereClause = whereConditions.join(' AND ');

        // Get total count for pagination
        const [countResult] = await db.promise().query(
            `SELECT COUNT(DISTINCT s.id) as total
             FROM submissions s
             LEFT JOIN submission_authors sa ON s.revision_id = sa.submission_id
             WHERE ${whereClause}`,
            queryParams
        );
        const totalCount = countResult[0].total;

        // Get paginated manuscripts
        const [manuscripts] = await db.promise().query(
            `SELECT s.*, 
                    GROUP_CONCAT(sa.authors_fullname SEPARATOR '||') as all_authors,
                    GROUP_CONCAT(sa.authors_email SEPARATOR '||') as all_emails
             FROM submissions s
             LEFT JOIN submission_authors sa ON s.revision_id = sa.submission_id
             WHERE ${whereClause}
             GROUP BY s.id
             ORDER BY s.${sortBy} ${sortOrder}
             LIMIT ? OFFSET ?`,
            [...queryParams, limit, offset]
        );

        // Format the manuscripts with author lists
        const formattedManuscripts = manuscripts.map(manuscript => {
            const authors = manuscript.all_authors ? manuscript.all_authors.split('||') : [];
            const authorEmails = manuscript.all_emails ? manuscript.all_emails.split('||') : [];
            
            // Find the corresponding author from the list
            const correspondingAuthorIndex = authorEmails.findIndex(email => email === manuscript.corresponding_authors_email);
            const correspondingAuthor = correspondingAuthorIndex >= 0 ? authors[correspondingAuthorIndex] : manuscript.corresponding_author;

            return {
                id: manuscript.revision_id,
                title: manuscript.title,
                type: manuscript.article_type,
                status: manuscript.status,
                decision: manuscript.decision || null,
                submittedDate: manuscript.date_submitted || manuscript.process_start_date,
                lastModified: manuscript.last_updated || manuscript.date_submitted,
                correspondingAuthor: correspondingAuthor || manuscript.corresponding_author,
                correspondingEmail: manuscript.corresponding_authors_email,
                abstract: manuscript.abstract,
                authors: authors,
                keywords: manuscript.keywords ? manuscript.keywords.split(',').map(k => k.trim()) : [],
                coAuthorRole: 'Co-Author'
            };
        });

        return res.json({
            status: "success",
            manuscripts: formattedManuscripts,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalCount: totalCount,
                limit: limit
            }
        });

    } catch (error) {
        console.error("Error fetching co-authored manuscripts:", error);
        return res.status(500).json({ 
            status: "error", 
            message: "Internal server error" 
        });
    }
};

module.exports = getCoAuthoredManuscripts;