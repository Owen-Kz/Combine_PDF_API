// backend/controllers/editors/getAllInvitations.js
const dbPromise = require("../../../routes/dbPromise.config");
const isAdminAccount = require("../isAdminAccount");
const sendInvitationReminder = require("../../utils/sendInvitationReminder");

const getAllInvitations = async (req, res) => {
    try {
        // Check if user is authenticated and is admin
        if (!req.user || !(await isAdminAccount(req.user.id))) {
            return res.status(403).json({ 
                success: false, 
                error: "Unauthorized Access" 
            });
        }

        // Get query parameters for pagination and filtering
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const filterRole = req.query.role || 'all'; // 'all', 'editor', 'reviewer'
        const filterStatus = req.query.status || 'all';
        const offset = (page - 1) * limit;

        // Build the base query
        let query = `
            SELECT 
                i.id,
                i.invited_user,
                i.invitation_link,
                i.invitation_date,
                i.invitation_status as status,
                i.invited_for,
                i.invitation_expiry_date as expiry_date,
                i.invited_user_name,
                
                -- Submission details
                s.id as submission_id,
                s.article_id as manuscript_id,
                s.revision_id,
                s.revisions_count,
                s.corrections_count,
                s.title,
                s.article_type,
                s.discipline,
                s.status as submission_status,
                s.date_submitted,
                s.process_start_date,
                s.last_updated,
                s.is_women_in_contemporary_science,
                s.is_kidnapping_for_ransom,
                s.is_belispoint_academic,
                s.corresponding_authors_email,
                s.previous_manuscript_id,
                s.corresponding_authors_email,
                
                -- Determine role based on invited_for
                CASE 
                    WHEN i.invited_for = 'To Edit' THEN 'editor'
                    WHEN i.invited_for = 'Submission Review' THEN 'reviewer'
                    ELSE 'other'
                END as role,
                
                -- Priority calculation based on expiry date
                CASE 
                    WHEN i.invitation_expiry_date < NOW() THEN 'expired'
                    WHEN i.invitation_expiry_date < DATE_ADD(NOW(), INTERVAL 3 DAY) THEN 'urgent'
                    WHEN i.invitation_expiry_date < DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 'high'
                    ELSE 'normal'
                END as priority,
                
                -- Reminder count
                i.reminder_count as reminder_count,
                
                -- Additional timestamps based on status
                CASE 
                    WHEN i.invitation_status = 'accepted' THEN i.invitation_date
                    ELSE NULL
                END as accepted_date,
                
                -- Get invited by info (from the user who created the invitation)
                -- This assumes you have a created_by field or you can get from session
                -- For now, we'll use a placeholder
                'System' as invited_by,
                'system@asfirj.org' as invited_by_email

            FROM invitations i
            LEFT JOIN submissions s ON i.invitation_link = s.revision_id
            WHERE 1=1
        `;

        let countQuery = `
            SELECT COUNT(*) as total
            FROM invitations i
            WHERE 1=1
        `;

        let params = [];
        let countParams = [];

        // Apply role filter
        if (filterRole !== 'all') {
            if (filterRole === 'editor') {
                query += ` AND i.invited_for = 'To Edit'`;
                countQuery += ` AND i.invited_for = 'To Edit'`;
            } else if (filterRole === 'reviewer') {
                query += ` AND i.invited_for = 'Submission Review'`;
                countQuery += ` AND i.invited_for = 'Submission Review'`;
            }
        }

        // Apply status filter
        if (filterStatus !== 'all') {
            query += ` AND i.invitation_status = ?`;
            countQuery += ` AND i.invitation_status = ?`;
            params.push(filterStatus);
            countParams.push(filterStatus);
        }

        // Apply search filter
        if (search && search.length >= 2) {
            const searchCondition = ` AND (
                i.invited_user LIKE ? OR 
                i.invited_user_name LIKE ? OR 
                i.id LIKE ? OR
                s.title LIKE ? OR
                s.article_id LIKE ? OR
                s.revision_id LIKE ?
            )`;
            
            const searchPattern = `%${search}%`;
            query += searchCondition;
            countQuery += searchCondition;
            
            const searchParams = [
                searchPattern, searchPattern, searchPattern,
                searchPattern, searchPattern, searchPattern
            ];
            params.push(...searchParams);
            countParams.push(...searchParams);
        }

        // Get total count for pagination
        const [countResult] = await dbPromise.query(countQuery, countParams);
        const total = countResult[0]?.total || 0;

        // Add pagination
        query += ` ORDER BY i.invitation_date DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        // Execute main query
        const [invitations] = await dbPromise.query(query, params);

        // Format the results for the frontend
        const formattedInvitations = invitations.map(inv => {
            // Generate a readable ID
            const invId = `INV-${new Date(inv.invitation_date).getFullYear()}-${String(inv.id).padStart(3, '0')}`;
            
            // Format dates
            const formatDate = (date) => {
                if (!date) return null;
                return new Date(date).toLocaleDateString('en-US', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric' 
                });
            };

            return {
                id: invId,
                manuscriptId: inv.manuscript_id || 'N/A',
                title: inv.title || 'Untitled Submission',
                type: inv.article_type || 'Not specified',
                invitedTo: inv.invited_user,
                invitedToEmail: inv.invited_user,
                invitedBy: inv?.invited_by || "ASFIRJ Editorial Board",
                invitedByEmail: inv.invited_user_name,
                invitedDate: inv.invitation_date,
                expiryDate: inv.expiry_date,
                status: inv.status || 'pending',
                priority: inv.priority || 'normal',
                role: inv.role,
                reminderCount: inv.reminder_count || 0,
                acceptedDate: inv.accepted_date ? formatDate(inv.accepted_date) : null,
                
                // Additional submission details
                submission: inv.submission_id ? {
                    id: inv.submission_id,
                    article_id: inv.manuscript_id,
                    revision_id: inv.revision_id,
                    revisions_count: inv.revisions_count,
                    corrections_count: inv.corrections_count,
                    discipline: inv.discipline,
                    submission_status: inv.submission_status,
                    date_submitted: formatDate(inv.date_submitted),
                    is_women_in_science: inv.is_women_in_contemporary_science === 'yes',
                    corresponding_email: inv.corresponding_authors_email
                } : null
            };
        });

        return res.json({
            success: true,
            invitations: formattedInvitations,
            total: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit: limit,
            stats: {
                total: total,
                editor: invitations.filter(i => i.role === 'editor').length,
                reviewer: invitations.filter(i => i.role === 'reviewer').length,
                pending: invitations.filter(i => i.status === 'pending').length,
                accepted: invitations.filter(i => i.status === 'accepted').length,
                declined: invitations.filter(i => i.status === 'declined').length,
                expired: invitations.filter(i => i.priority === 'expired' || i.status === 'expired').length
            }
        });

    } catch (error) {
        console.error("Error fetching invitations:", error);
        return res.status(500).json({ 
            success: false, 
            error: "Server error", 
            message: error.message 
        });
    }
};

// GET /api/invitations/:id
const getInvitationById = async (req, res) => {
    try {
        if (!req.user || !(await isAdminAccount(req.user.id))) {
            return res.status(403).json({ success: false, error: "Unauthorized" });
        }

        const { id } = req.params;
        
        const [invitation] = await dbPromise.query(`
            SELECT 
                i.*,
                s.title,
                s.article_id,
                s.revision_id,
                s.article_type,
                s.discipline,
                s.status as submission_status,
                s.corresponding_authors_email,
                a.firstname,
                a.lastname,
                a.prefix,
                a.affiliations
            FROM invitations i
            LEFT JOIN submissions s ON i.invitation_link = s.revision_id
            LEFT JOIN authors_account a ON s.corresponding_authors_email = a.email
            WHERE i.id = ?
        `, [id]);

        if (invitation.length === 0) {
            return res.status(404).json({ success: false, error: "Invitation not found" });
        }

        // For reviewer invitations, attach the submitted review (if any) so the
        // invitations management page can display it when clicking the eye icon.
        let review = null;
        if (invitation[0].invited_for === 'Submission Review') {
            const [reviewRows] = await dbPromise.query(`
                SELECT 
                    r.*,
                    CONCAT_WS(' ', a.prefix, a.firstname, a.lastname) AS reviewer_name
                FROM reviews r
                LEFT JOIN authors_account a ON r.reviewer_email = a.email
                WHERE r.article_id = ? AND r.reviewer_email = ?
                  AND r.review_status IN ('review_submitted', 'completed')
                ORDER BY r.id DESC
                LIMIT 1
            `, [invitation[0].invitation_link, invitation[0].invited_user]);
            if (reviewRows.length > 0) {
                review = reviewRows[0];
                review.reviewer_name = (review.reviewer_name || '').trim() || review.reviewer_email || 'Reviewer';
            }
        }

        return res.json({ success: true, invitation: invitation[0], review });

    } catch (error) {
        console.error("Error fetching invitation:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/invitations/:id/resend
const resendInvitation = async (req, res) => {
    try {
        if (!req.user || !(await isAdminAccount(req.user.id))) {
            return res.status(403).json({ success: false, error: "Unauthorized" });
        }

        const { id } = req.params;
        const { reason } = req.body;

        // Update invitation with new date and increment reminder count
        await dbPromise.query(`
            UPDATE invitations 
            SET invitation_date = NOW(),
                invitation_expiry_date = DATE_ADD(NOW(), INTERVAL 14 DAY),
                reminder_count = reminder_count + 1,
                last_reminder_sent = NOW()
            WHERE id = ?
        `, [id]);

        // Log the resend action
        await dbPromise.query(`
            INSERT INTO invitation_logs (invitation_id, action, performed_by, reason, performed_at)
            VALUES (?, 'resent', ?, ?, NOW())
        `, [id, req.user.email, reason || 'No reason provided']);

        return res.json({ 
            success: true, 
            message: "Invitation resent successfully" 
        });

    } catch (error) {
        console.error("Error resending invitation:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/invitations/:id/cancel
const cancelInvitation = async (req, res) => {
    try {
        if (!req.user || !(await isAdminAccount(req.user.id))) {
            return res.status(403).json({ success: false, error: "Unauthorized" });
        }

        const { id } = req.params;
        const { reason } = req.body;

        await dbPromise.query(`
            UPDATE invitations 
            SET invitation_status = 'cancelled',
                cancellation_reason = ?,
                cancelled_at = NOW(),
                cancelled_by = ?
            WHERE id = ?
        `, [reason, req.user.email, id]);

        // Log the cancellation
        await dbPromise.query(`
            INSERT INTO invitation_logs (invitation_id, action, performed_by, reason, performed_at)
            VALUES (?, 'cancelled', ?, ?, NOW())
        `, [id, req.user.email, reason || 'No reason provided']);

        return res.json({ 
            success: true, 
            message: "Invitation cancelled successfully" 
        });

    } catch (error) {
        console.error("Error cancelling invitation:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// POST /api/invitations/:id/remind
const remindInvitation = async (req, res) => {
    try {
        if (!req.user || !(await isAdminAccount(req.user.id))) {
            return res.status(403).json({ success: false, error: "Unauthorized" });
        }

        const { id } = req.params;

        const [invitationRows] = await dbPromise.query(`
            SELECT 
                i.*,
                s.title,
                s.revision_id,
                s.article_id,
                s.corresponding_authors_email
            FROM invitations i
            LEFT JOIN submissions s ON i.invitation_link = s.revision_id
            WHERE i.id = ?
        `, [id]);

        if (invitationRows.length === 0) {
            return res.status(404).json({ success: false, error: "Invitation not found" });
        }

        const inv = invitationRows[0];

        const remindableStatuses = ['pending', 'invite_sent', 'accepted'];
        if (!remindableStatuses.includes(inv.invitation_status)) {
            return res.status(400).json({
                success: false,
                error: `A reminder cannot be sent for an invitation with status '${inv.invitation_status}'`
            });
        }

        const recipientEmail = inv.invited_user;
        const manuscriptId = inv.revision_id || inv.article_id || inv.invitation_link;

        let daysUntilExpiry = 14;
        if (inv.invitation_expiry_date) {
            const diff = Math.ceil(
                (new Date(inv.invitation_expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
            );
            daysUntilExpiry = Math.max(diff, 0);
        }

        const emailResult = await sendInvitationReminder({
            recipientEmail,
            invitedFor: inv.invited_for,
            manuscriptId,
            daysUntilExpiry,
            expiryDate: inv.invitation_expiry_date
        });

        if (emailResult.status !== 'success') {
            console.error("Error sending manual invitation reminder:", emailResult.message);
            return res.status(500).json({
                success: false,
                error: "Failed to send the reminder email"
            });
        }

        await dbPromise.query(`
            UPDATE invitations 
            SET reminder_count = reminder_count + 1,
                last_reminder_sent = NOW()
            WHERE id = ?
        `, [id]);

        await dbPromise.query(`
            INSERT INTO invitation_logs (invitation_id, action, performed_by, reason, performed_at)
            VALUES (?, 'reminder_sent', ?, ?, NOW())
        `, [id, req.user.email, 'Manual reminder sent']);

        await dbPromise.query(`
            INSERT INTO sent_emails (article_id, sender, recipient, subject, status, body, sent_at, email_for)
            VALUES (?, ?, ?, ?, 'Delivered', ?, NOW(), 'invitation_reminder')
        `, [manuscriptId, req.user.email, recipientEmail, emailResult.subject, 'Manual invitation reminder']);

        return res.json({
            success: true,
            message: `Reminder sent successfully to ${recipientEmail}`
        });

    } catch (error) {
        console.error("Error sending invitation reminder:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// GET /api/invitations/stats
const getInvitationStats = async (req, res) => {
    try {
        if (!req.user || !(await isAdminAccount(req.user.id))) {
            return res.status(403).json({ success: false, error: "Unauthorized" });
        }

        const [stats] = await dbPromise.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN invited_for = 'To Edit' THEN 1 ELSE 0 END) as editor_count,
                SUM(CASE WHEN invited_for = 'Submission Review' THEN 1 ELSE 0 END) as reviewer_count,
                SUM(CASE WHEN invitation_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN invitation_status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
                SUM(CASE WHEN invitation_status = 'declined' THEN 1 ELSE 0 END) as declined_count,
                SUM(CASE WHEN invitation_expiry_date < NOW() AND invitation_status = 'pending' THEN 1 ELSE 0 END) as expired_count
            FROM invitations
        `);

        return res.json({ success: true, stats: stats[0] });

    } catch (error) {
        console.error("Error fetching invitation stats:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
module.exports = {
    getAllInvitations,
    resendInvitation,
    cancelInvitation,
    remindInvitation,
    getInvitationStats,
    getInvitationById
};