const db = require("../../../routes/db.config");
const isAdminAccount = require("../isAdminAccount");


const getEditorInvitations = async (req, res) => {
    try {
        const userEmail = req.user.email;
        const userId = req.user.id;

        // Check if user is admin or editor
        const isAdmin = await isAdminAccount(userId);

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // Search and filter parameters
        const search = req.query.search || '';
        const filterStatus = req.query.status || 'all'; // 'all', 'pending', 'accepted', 'declined', 'completed'

        // Base query for invitations
        let query = `
            SELECT 
                i.id as invitation_id,
                i.invited_user,
                i.invitation_link as manuscript_id,
                i.invitation_date,
                i.invitation_status,
                i.invited_for,
                i.invitation_expiry_date,
                i.invited_user_name,
                -- Get manuscript details from submissions
                s.title,
                s.abstract,
                s.article_type,
                s.discipline,
                s.corresponding_authors_email,
                s.manuscript_file,
                s.document_file,
                s.tracked_manuscript_file,
                s.cover_letter_file,
                s.tables,
                s.figures,
                s.graphic_abstract,
                s.supplementary_material,
                -- Get author names
                (SELECT GROUP_CONCAT(CONCAT_WS(' ', a.prefix, a.firstname, a.lastname) SEPARATOR ';') 
                 FROM submission_authors sa 
                 LEFT JOIN authors_account a ON sa.authors_email = a.email 
                 WHERE sa.submission_id = s.article_id) as authors,
                -- Get invitation email content
                se.subject as email_subject,
                se.body as email_body,
                se.sender as email_sender,
                se.sent_at as email_sent_at,
                -- Get inviter details
                inviter.fullname as invited_by_name,
                inviter.email as invited_by_email
            FROM invitations i
            LEFT JOIN submissions s ON i.invitation_link = s.revision_id OR i.invitation_link = s.article_id
            LEFT JOIN sent_emails se ON i.invitation_link = se.article_id AND se.email_for = 'To Edit'
            LEFT JOIN editors inviter ON se.sender = inviter.email
            WHERE i.invited_user = ? AND i.invited_for = 'To Edit'
        `;

        let countQuery = `
            SELECT COUNT(*) as total 
            FROM invitations 
            WHERE invited_user = ? AND invited_for = 'To Edit'
        `;

        let queryParams = [userEmail];
        let countParams = [userEmail];

        // Add search conditions
        if (search && search.length >= 2) {
            const searchCondition = ` AND (
                s.title LIKE ? OR 
                i.invitation_link LIKE ? OR 
                s.corresponding_authors_email LIKE ? OR
                s.abstract LIKE ?
            )`;
            
            query += searchCondition;
            
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        // Add status filter
        if (filterStatus !== 'all') {

            let status = filterStatus

            if(filterStatus === 'pending'){
                status = "invite_sent"
            }
            
            const statusCondition = ` AND i.invitation_status = ?`;
            query += statusCondition;
            queryParams.push(status);
        }

        // Add ordering and pagination
        query += " ORDER BY i.invitation_date DESC LIMIT ? OFFSET ?";
        queryParams.push(limit, offset);

        // Get total count for pagination
        const [countResult] = await db.promise().query(countQuery, countParams);

        // Execute main query
        const [invitations] = await db.promise().query(query, queryParams);

        // Format the results
        const formattedInvitations = invitations.map(inv => {
            // Parse authors string into array
            const authorsList = inv.authors ? inv.authors.split(';').map(a => a.trim()) : [];
            
            // Determine if user can view files (only if accepted)
            const canViewFiles = inv.invitation_status === 'accepted' || inv.invitation_status === 'completed';

            // Collect files (only include if user has permission)
            const files = {};
            if (canViewFiles) {
                if (inv.manuscript_file) files.manuscript = inv.manuscript_file;
                if (inv.document_file) files.document = inv.document_file;
                if (inv.tracked_manuscript_file) files.tracked_manuscript = inv.tracked_manuscript_file;
                if (inv.cover_letter_file) files.cover_letter = inv.cover_letter_file;
                if (inv.tables) files.tables = inv.tables;
                if (inv.figures) files.figures = inv.figures;
                if (inv.graphic_abstract) files.graphic_abstract = inv.graphic_abstract;
                if (inv.supplementary_material) files.supplementary = inv.supplementary_material;
            }

            // Calculate priority based on expiry date
            let priority = 'normal';
            if (inv.invitation_expiry_date) {
                const expiryDate = new Date(inv.invitation_expiry_date);
                const today = new Date();
                const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                
                if (daysUntilExpiry <= 2) priority = 'urgent';
                else if (daysUntilExpiry <= 5) priority = 'high';
                else if (daysUntilExpiry <= 10) priority = 'normal';
                else priority = 'low';
            }

            return {
                id: inv.invitation_id,
                manuscriptId: inv.manuscript_id,
                title: inv.title || 'Manuscript Title',
                type: inv.article_type || 'Research Article',
                invitedBy: inv.invited_by_name || 'Editor',
                invitedByEmail: inv.invited_by_email || inv.email_sender || 'editor@asfirj.org',
                invitedDate: inv.invitation_date ? new Date(inv.invitation_date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }) : 'N/A',
                dueDate: inv.invitation_expiry_date ? new Date(inv.invitation_expiry_date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }) : 'N/A',
                status: inv.invitation_status || 'pending',
                priority,
                abstract: inv.abstract || 'No abstract available',
                authors: authorsList,
                correspondingAuthor: inv.corresponding_author || inv.firstname,
                correspondingEmail: inv.corresponding_authors_email || '',
                files,
                canViewFiles,
                emailContent: inv.email_body ? {
                    subject: inv.email_subject,
                    body: inv.email_body,
                    sender: inv.email_sender,
                    sentAt: inv.email_sent_at
                } : null,
                invitedUserName: inv.invited_user_name
            };
        });

        return res.json({
            success: true,
            invitations: formattedInvitations,
            total: countResult[0]?.total || 0,
            page,
            limit,
            totalPages: Math.ceil((countResult[0]?.total || 0) / limit)
        });

    } catch (error) {
        console.error("Error fetching editor invitations:", error);
        return res.status(500).json({ 
            error: "Failed to fetch invitations", 
            message: error.message 
        });
    }
};

module.exports = getEditorInvitations;