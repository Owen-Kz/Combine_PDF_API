// backend/controllers/editors/myPreviousSubmissions.js
const db = require("../../routes/db.config");
const isAdminAccount = require("./isAdminAccount");

const myPreviousSubmissions = async (req, res) => {
    try {
        const editorEmail = req.user.email;
        const editorId = req.user.id;
        const { revision_id, item_id } = req.body;
        
        let revisionID = revision_id || item_id;
        let mainId = revisionID;

        if (!editorEmail || !revisionID) {
            return res.status(400).json({ error: "Invalid Parameters" });
        }

        // Remove part after '.R' in revisionID if present
        if (revisionID.includes('.R')) {
            revisionID = revisionID.split('.R')[0];
        }
         if (revisionID.includes('.Cr')) {
            revisionID = revisionID.split('.Cr')[0];
        }
        console.log("REVISION ID FOR RANKED PREVIOUS", revisionID)

        // First, get the article_id for this revision
        const [articleResult] = await db.promise().query(
            "SELECT article_id FROM submissions WHERE revision_id = ? OR article_id = ? LIMIT 1",
            [revisionID, revisionID]
        );
        if (articleResult.length === 0) {
            return res.json({ 
                success: true, 
                submissions: [],
                message: "No previous submissions found"
            });
        }

        const articleId = articleResult[0].article_id;

        const isAdmin = await isAdminAccount(editorId);
        
        if (isAdmin) {
            // Admin account: Get all previous submissions for this article
            const query = `
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
                            PARTITION BY s.revision_id 
                            ORDER BY s.process_start_date DESC
                        ) AS row_num,
                        -- Invitation counts for this revision
                        (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND (invitation_status = 'accepted' OR invitation_status = 'review_invitation_accepted' OR invitation_status = 'review_submitted')) as accepted_reviewers,
                        (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND invitation_status = 'declined') as declined_reviewers,
                        (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND invitation_status = 'invite_sent') as pending_reviewers,
                        (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND (invitation_status = 'accepted' OR invitation_status = 'edit_invitation_accepted' OR invitation_status = 'edit_submitted')) as accepted_editors,
                        (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND invitation_status = 'declined') as declined_editors,
                        (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND invitation_status = 'invite_sent') as pending_editors
                    FROM submissions s
                    LEFT JOIN authors_account a ON s.corresponding_authors_email = a.email
                    WHERE s.article_id = ? OR s.previous_manuscript_id = ?
                    AND s.title != '' 
                    AND s.title != 'Draft Submission'
                    AND s.status NOT IN ('saved_for_later', 'revision_saved', 'returned')
                )
                SELECT *
                FROM RankedSubmissions
                WHERE row_num = 1
                ORDER BY 
                    CASE 
                        WHEN revision_id = ? THEN 0 
                        ELSE 1 
                    END,
                    process_start_date DESC
            `;
            
            const [results] = await db.promise().query(query, [articleId, articleId, mainId]);

            // Format the results
            const formattedSubmissions = results.map(row => {
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
                    date: new Date(row.date_submitted).toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric' 
                    }),
                    submittedDate: row.date_submitted || row.process_start_date,
                    updatedAt: row.last_updated,
                    isWomenInScience: row.is_women_in_science === 'yes' || row.is_women_in_science === 1,
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
                    files: files,
                    isCurrentVersion: row.revision_id === mainId || row.revision_id === revision_id
                };
            });

            return res.json({
                success: true,
                submissions: formattedSubmissions,
                total: formattedSubmissions.length
            });

        } else {
            // Non-admin: Check for submissions they were invited to edit
            const [invitedArticles] = await db.promise().query(
                `SELECT DISTINCT article_id 
                 FROM submitted_for_edit 
                 WHERE editor_email = ?`,
                [editorEmail]
            );

            if (invitedArticles.length === 0) {
                return res.json({ 
                    success: true, 
                    submissions: [],
                    message: "No previous submissions found"
                });
            }

            const articleIds = invitedArticles.map(row => row.article_id);

            // Get all submissions for articles this editor is assigned to
            const query = `
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
                            PARTITION BY s.revision_id 
                            ORDER BY s.process_start_date DESC
                        ) AS row_num,
                        -- Invitation counts for this revision
                        (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND (invitation_status = 'accepted' OR invitation_status = 'review_invitation_accepted' OR invitation_status = 'review_submitted')) as accepted_reviewers,
                        (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND invitation_status = 'declined') as declined_reviewers,
                        (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND invitation_status = 'invite_sent') as pending_reviewers,
                        (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND (invitation_status = 'accepted' OR invitation_status = 'edit_invitation_accepted' OR invitation_status = 'edit_submitted')) as accepted_editors,
                        (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND invitation_status = 'declined') as declined_editors,
                        (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND invitation_status = 'invite_sent') as pending_editors
                    FROM submissions s
                    LEFT JOIN authors_account a ON s.corresponding_authors_email = a.email
                    WHERE s.article_id IN (?)
                    AND s.title != '' 
                    AND s.title != 'Draft Submission'
                    AND s.status NOT IN ('saved_for_later', 'revision_saved', 'returned')
                )
                SELECT *
                FROM RankedSubmissions
                WHERE row_num = 1
                ORDER BY 
                    CASE 
                        WHEN revision_id = ? THEN 0 
                        ELSE 1 
                    END,
                    process_start_date DESC
            `;

            const [results] = await db.promise().query(query, [articleIds, mainId]);

            // Format the results (same formatting as admin)
            const formattedSubmissions = results.map(row => {
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
                    submittedDate: row.date_submitted || row.process_start_date,
                    updatedAt: row.last_updated,
                    isWomenInScience: row.is_women_in_science === 'yes' || row.is_women_in_science === 1,
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
                    files: files,
                    isCurrentVersion: row.revision_id === mainId || row.revision_id === revision_id
                };
            });

            return res.json({
                success: true,
                submissions: formattedSubmissions,
                total: formattedSubmissions.length
            });
        }

    } catch (error) {
        console.error("Error in myPreviousSubmissions:", error);
        return res.status(500).json({ error: "Server error", message: error.message });
    }
};

module.exports = myPreviousSubmissions;