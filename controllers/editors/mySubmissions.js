// backend/controllers/editors/mySubmissions.js
const db = require("../../routes/db.config");

const mySubmissions = async (req, res) => {
    try {
        const editorEmail = req.user.email;
        const editorId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        if (!editorEmail || !editorId) {
            return res.status(400).json({ error: "Invalid Parameters" });
        }

        // First, get all article IDs this editor is assigned to
        let assignedQuery = `
            SELECT DISTINCT article_id 
            FROM submitted_for_edit 
            WHERE editor_email = ?
        `;
        
        let assignedParams = [editorEmail];
        let countParams = [editorEmail];

        // If search exists, filter the assigned articles
        if (search && search.length >= 2) {
            assignedQuery += ` AND article_id IN (
                SELECT DISTINCT s.article_id 
                FROM submissions s
                LEFT JOIN authors_account a ON s.corresponding_authors_email = a.email
                WHERE s.title != '' AND s.title != 'Draft Submission' AND (
                    s.title LIKE ? OR 
                    s.article_id LIKE ? OR 
                    s.revision_id LIKE ? OR
                    s.status LIKE ? OR
                    a.firstname LIKE ? OR
                    a.lastname LIKE ?
                )
            )`;
            
            const searchPattern = `%${search}%`;
            const searchParams = [
                searchPattern, searchPattern, searchPattern, 
                searchPattern, searchPattern, searchPattern
            ];
            assignedParams.push(...searchParams);
            countParams.push(...searchParams);
        }

        // Get total count for pagination
        const [countResult] = await db.promise().query(
            `SELECT COUNT(*) as total FROM (${assignedQuery}) as temp`,
            countParams
        );

        // Add pagination to the assigned query
        assignedQuery += ` LIMIT ? OFFSET ?`;
        assignedParams.push(limit, offset);

        // Get paginated assigned article IDs
        const [assignedArticles] = await db.promise().query(assignedQuery, assignedParams);

        if (assignedArticles.length === 0) {
            return res.json({
                success: true,
                submissions: [],
                total: 0,
                totalPages: 0,
                currentPage: page,
                limit: limit
            });
        }

        // Get the article IDs array
        const articleIds = assignedArticles.map(row => row.article_id);

        // Now get the submissions for these articles (latest revision only)
        const submissionsQuery = `
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
                WHERE s.article_id IN (?)
            )
            SELECT *
            FROM RankedSubmissions
            WHERE row_num = 1
            ORDER BY id DESC
        `;

        const [submissions] = await db.promise().query(submissionsQuery, [articleIds]);

        // Format the results (same formatting as allSubmissions)
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

            return {
                id: row.article_id,
                article_id: row.article_id,
                revision_id: row.revision_id,
                revisions_count: row.revisions_count,
                corrections_count: row.corrections_count,
                previous_manuscript_id: row.previous_manuscript_id,
                title: row.title,
                abstract: row.abstract,
                type: row.article_type,
                discipline: row.discipline,
                status: row.status,
                date: new Date(row.process_start_date).toLocaleDateString('en-GB', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric' 
                }),
                submittedDate:row.date_submitted || row.process_start_date,
                updatedAt: row.last_updated,
                isWomenInScience: row.is_women_in_science === 'yes',
                authors: authorName,
                correspondingAuthor: `${row.prefix} ${row.firstname} ${row.lastname}` ,

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
                files: files
            };
        });

        return res.json({
            success: true,
            submissions: formattedSubmissions,
            total: countResult[0]?.total || 0,
            totalPages: Math.ceil((countResult[0]?.total || 0) / limit),
            currentPage: page,
            limit: limit
        });

    } catch (error) {
        console.error("Error in mySubmissions:", error);
        return res.status(500).json({ error: "Server error", message: error.message });
    }
};

module.exports = mySubmissions;