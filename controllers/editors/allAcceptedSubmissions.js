// backend/controllers/editors/allAcceptedSubmissions.js
const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");

const allAcceptedSubmissions = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.body.search || '';
        const offset = (page - 1) * limit;

        if (!userId) {
            return res.status(400).json({ error: "Invalid Parameters" });
        }
        
        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // Base query for decisioned submissions (Accepted/Rejected)
        let baseQuery = `
            WITH RankedSubmissions AS (
                SELECT 
                    s.id,
                    s.article_id,
                    s.revision_id,
                    s.revisions_count,
                    s.corrections_count,
                    s.previous_manuscript_id,
                    s.title,
                    s.abstract,
                    s.article_type,
                    s.discipline,
                    s.status,
                    s.date_submitted,
                    s.process_start_date,
                    s.last_updated,
                    s.is_women_in_contemporary_science as is_women_in_science,
                    s.corresponding_authors_email as corresponding_email,
                    s.manuscript_file,
                    s.document_file,
                    s.tracked_manuscript_file,
                    s.cover_letter_file,
                    s.tables,
                    s.figures,
                    s.graphic_abstract,
                    s.supplementary_material,
                    a.firstname,
                    a.lastname,
                    a.email as author_email,
                    a.orcid_id,
                    a.affiliations,
                    a.prefix,
                    ROW_NUMBER() OVER (
                        PARTITION BY s.article_id 
                        ORDER BY s.revision_id DESC, s.process_start_date DESC
                    ) AS row_num,
                    -- Invitation counts
                    (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND (invitation_status = 'accepted' OR invitation_status = 'review_invitation_accepted' OR invitation_status = 'review_submitted')) as accepted_reviewers,
                    (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND invitation_status = 'declined') as declined_reviewers,
                    (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND invitation_status = 'invite_sent') as pending_reviewers,
                    (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND (invitation_status = 'accepted' OR invitation_status = 'edit_invitation_accepted' OR invitation_status = 'edit_submitted')) as accepted_editors,
                    (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND invitation_status = 'declined') as declined_editors,
                    (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND invitation_status = 'invite_sent') as pending_editors
                FROM submissions s
                LEFT JOIN authors_account a ON s.corresponding_authors_email = a.email
                WHERE s.title != '' 
                AND s.title != 'Draft Submission' 
                AND (LOWER(s.status) = 'accepted' OR LOWER(s.status) = 'rejected')
        `;

        let countQuery = `
            SELECT COUNT(DISTINCT s.article_id) as total
            FROM submissions s
            LEFT JOIN authors_account a ON s.corresponding_authors_email = a.email
            WHERE s.title != '' 
            AND s.title != 'Draft Submission'
            AND (LOWER(s.status) = 'accepted' OR LOWER(s.status) = 'rejected')
        `;

        let queryParams = [];
        let countParams = [];

        // Add search conditions if search query exists
        if (search && search.length >= 2) {
            const searchCondition = ` AND (
                s.title LIKE ? OR 
                s.article_id LIKE ? OR 
                s.revision_id LIKE ? OR
                LOWER(s.status) LIKE ? OR
                a.firstname LIKE ? OR
                a.lastname LIKE ?
            )`;
            
            baseQuery += searchCondition;
            countQuery += searchCondition;
            
            const searchPattern = `%${search}%`;
            const searchStatus = `%${search.toLowerCase()}%`;
            // 6 parameters for the 6 conditions
            const searchParams = [
                searchPattern, searchPattern, searchPattern, 
                searchStatus, searchPattern, searchPattern
            ];
            queryParams.push(...searchParams);
            countParams.push(...searchParams);
        }

        // Complete the base query
        baseQuery += `
            )
            SELECT *
            FROM RankedSubmissions
            WHERE row_num = 1
            ORDER BY process_start_date DESC
            LIMIT ? OFFSET ?
        `;

        queryParams.push(limit, offset);

        // Execute queries
        const [submissions] = await db.promise().query(baseQuery, queryParams);
        const [countResult] = await db.promise().query(countQuery, countParams);

        // Format the results
        const formattedSubmissions = submissions.map(row => {
            // Combine author name
            let authorName = 'Unknown';
            if (row.firstname && row.lastname) {
                authorName = `${row.firstname} ${row.lastname}`;
            } else if (row.firstname) {
                authorName = row.firstname;
            } else if (row.lastname) {
                authorName = row.lastname;
            }

            // Add prefix if available
            if (row.prefix && authorName !== 'Unknown') {
                authorName = `${row.prefix} ${authorName}`;
            }

            // Format corresponding author with prefix
            let correspondingAuthor = '';
            if (row.prefix || row.firstname || row.lastname) {
                const parts = [];
                if (row.prefix) parts.push(row.prefix);
                if (row.firstname) parts.push(row.firstname);
                if (row.lastname) parts.push(row.lastname);
                correspondingAuthor = parts.join(' ');
            } else {
                correspondingAuthor = row.corresponding_email?.split('@')[0] || 'Unknown';
            }

            // Collect files
            const files = {};
            if (row.manuscript_file) files.manuscript = row.manuscript_file;
            if (row.document_file) files.document = row.document_file;
            if (row.tracked_manuscript_file) files.tracked_manuscript = row.tracked_manuscript_file;
            if (row.cover_letter_file) files.cover_letter = row.cover_letter_file;
            if (row.tables) files.tables = row.tables;
            if (row.figures) files.figures = row.figures;
            if (row.graphic_abstract) files.graphic_abstract = row.graphic_abstract;
            if (row.supplementary_material) files.supplementary = row.supplementary_material;
            
            // Add decision letter (for accepted/rejected)
            if (row.status?.toLowerCase() === 'accepted') {
                files.decision_letter = `acceptance_letter_${row.article_id}.pdf`;
            } else if (row.status?.toLowerCase() === 'rejected') {
                files.decision_letter = `rejection_letter_${row.article_id}.pdf`;
            }

            // Create authors array from individual author records
            // This is a simplified version - in a real app, you might need to fetch all authors from submission_authors table
            const authorsArray = [authorName];
            
            // You could also add co-authors here if you have them in the database
            // For now, we'll just use the corresponding author as the main author

            return {
                id: row.article_id,
                article_id: row.article_id,
                revision_id: row.revision_id,
                revisions_count: row.revisions_count,
                corrections_count: row.corrections_count,
                previous_manuscript_id: row.previous_manuscript_id,
                title: row.title,
                abstract: row.abstract,
                type: row.article_type || 'Research Article',
                discipline: row.discipline,
                decision: row.status?.toLowerCase() === 'accepted' ? 'accepted' : 'rejected',
                status: row.status,
                date: new Date(row.date_submitted).toLocaleDateString('en-GB', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric' 
                }),
                submittedDate: row.date_submitted,
                decisionDate: row.process_start_date ? new Date(row.process_start_date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }) : 'N/A',
                updatedAt: row.last_updated,
                isWomenInScience: row.is_women_in_science === 'yes' || row.is_women_in_science === 1,
                authors: authorsArray,
                correspondingAuthor: correspondingAuthor,
                correspondingEmail: row.corresponding_email,
                authorEmail: row.author_email,
                orcidId: row.orcid_id,
                affiliations: row.affiliations,
                reviewerInvitations: {
                    accepted: row.accepted_reviewers || 0,
                    declined: row.declined_reviewers || 0,
                    pending: row.pending_reviewers || 0
                },
                editorInvitations: {
                    accepted: row.accepted_editors || 0,
                    declined: row.declined_editors || 0,
                    pending: row.pending_editors || 0
                },
                files: files,
                decisionMaker: 'Editor', // This could be fetched from editors table if you have the info
                decisionMakerEmail: req.user.email,
                decisionNotes: `This manuscript has been ${row.status?.toLowerCase() === 'accepted' ? 'accepted' : 'rejected'} for publication.`,
                keywords: [] // Keywords would need to be fetched from submission_keywords table
            };
        });

        return res.json({
            success: "Admin Account",
            submissions: formattedSubmissions,
            total: countResult[0]?.total || 0,
            totalPages: Math.ceil((countResult[0]?.total || 0) / limit),
            currentPage: page,
            limit: limit
        });

    } catch (error) {
        console.error("Error in allAcceptedSubmissions:", error);
        return res.status(500).json({ error: "Server error", message: error.message });
    }
};

module.exports = allAcceptedSubmissions;