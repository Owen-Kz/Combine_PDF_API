// backend/controllers/editors/getAllAuthors.js
const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");

const getAllAuthors = async (req, res) => {
    try {
        // Get user ID from session
        const userId = req.user?.id;
        if (!userId) {
            return res.status(400).json({ status: "error", message: "Invalid Parameters" });
        }

        // Check if the user is an admin
        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ status: "error", message: "Unauthorized Access" });
        }

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        // Search parameter
        const search = req.query.search || '';
        const filterStatus = req.query.status || 'all'; // 'all', 'verified', 'unverified'

        // Base query with subqueries for counts
        let query = `
            SELECT 
                a.*,
                -- Count submissions from submissions table
                (
                    SELECT COUNT(*) 
                    FROM submissions s 
                    WHERE s.corresponding_authors_email = a.email 
                    AND s.title != '' 
                    AND s.title != 'Draft Submission'
                ) as submissions_count,
                -- Count archived submissions
                (
                    SELECT COUNT(*) 
                    FROM archived_submissions ar 
                    WHERE ar.corresponding_authors_email = a.email
                ) as archived_count,
                -- Count reviews
                (
                    SELECT COUNT(*) 
                    FROM reviews r 
                    WHERE r.reviewer_email = a.email
                    AND r.review_status = 'review_submitted'
                ) as reviews_count
            FROM authors_account a
            WHERE 1=1
        `;
        
        let countQuery = "SELECT COUNT(*) as total FROM authors_account WHERE 1=1";
        let queryParams = [];
        let countParams = [];

        // Add search conditions
        if (search && search.length >= 2) {
            const searchCondition = ` AND (
                firstname LIKE ? OR 
                lastname LIKE ? OR 
                email LIKE ? OR 
                affiliations LIKE ? OR 
                affiliation_city LIKE ? OR 
                affiliation_country LIKE ? OR
                CONCAT(firstname, ' ', lastname) LIKE ?
            )`;
            
            query += searchCondition;
            countQuery += searchCondition;
            
            const searchPattern = `%${search}%`;
            // 7 parameters for the 7 conditions
            const searchParams = [
                searchPattern, searchPattern, searchPattern, 
                searchPattern, searchPattern, searchPattern, searchPattern
            ];
            queryParams.push(...searchParams);
            countParams.push(...searchParams);
        }

        // Add status filter
        if (filterStatus !== 'all') {
            const statusCondition = ` AND account_status = ?`;
            query += statusCondition;
            countQuery += statusCondition;
            queryParams.push(filterStatus);
            countParams.push(filterStatus);
        }

        // Add ordering and pagination
        query += " ORDER BY id DESC LIMIT ? OFFSET ?";
        queryParams.push(limit, offset);

        // Execute both queries
        const [authors] = await db.promise().query(query, queryParams);
        const [countResult] = await db.promise().query(countQuery, countParams);

        // Format the authors data
        const formattedAuthors = authors.map(author => {
            // Calculate total submissions (regular + archived)
            const totalSubmissions = (parseInt(author.submissions_count) || 0) + (parseInt(author.archived_count) || 0);
            
            return {
                id: author.email, // Use email as unique identifier
                email: author.email,
                title: author.prefix || '',
                firstName: author.firstname || '',
                lastName: author.lastname || '',
                fullName: [author.prefix, author.firstname, author.lastname, author.othername]
                    .filter(Boolean)
                    .join(' ')
                    .trim(),
                affiliation: author.affiliations || '',
                city: author.affiliation_city || '',
                country: author.affiliation_country || '',
                date: author.date_joined ? new Date(author.date_joined).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }) : 'N/A',
                status: author.account_status || 'unverified',
                role: author.is_editor === 'yes' ? 'editor' : (author.is_reviewer === 'yes' ? 'reviewer' : 'author'),
                submissions: totalSubmissions,
                activeSubmissions: parseInt(author.submissions_count) || 0,
                archivedSubmissions: parseInt(author.archived_count) || 0,
                reviews: parseInt(author.reviews_count) || 0,
                orcid: author.orcid_id || '',
                bio: author.bio || '',
                isEditor: author.is_editor === 'yes',
                isReviewer: author.is_reviewer === 'yes',
                asfiMembershipId: author.asfi_membership_id || ''
            };
        });

        return res.json({
            status: "success",
            authors: formattedAuthors,
            total: countResult[0]?.total || 0,
            page,
            limit,
            totalPages: Math.ceil((countResult[0]?.total || 0) / limit)
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: "error", message: error.message });
    }
};

module.exports = getAllAuthors;