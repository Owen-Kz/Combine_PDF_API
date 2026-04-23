const express = require("express");
const { config } = require("dotenv");
const dbPromise = require("./dbPromise.config");
const AuthorLoggedIn = require("../controllers/account/AuthorLoggedIn");
const router = express.Router();

config();

// Helper function to get user's emails (as sender or recipient)
async function getUserEmails(userEmail, folder = 'inbox', search = '') {
    let query;
    let params = [];
    
    // For sent folder, we need a different query structure
    if (folder === 'sent') {
        // Base query for sent emails
        query = `
            SELECT 
                se.*,
                'sent' as direction,
                EXISTS(SELECT 1 FROM email_read_receipts err WHERE err.email_id = se.id AND err.user_email = ?) as is_read_by_me
            FROM sent_emails se
            WHERE se.sender = ? AND se.status IN ('unread', 'sent', 'Sent', 'Delivered')
        `;
        
        params = [userEmail, userEmail];
        
        // Add search if provided
        if (search) {
            query += ` AND (se.subject LIKE ? OR se.body LIKE ? OR se.recipient LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
    } else {
        // For other folders (inbox, unread, archived, trash)
        let statusCondition = '';
        
        switch(folder) {
            case 'inbox':
                statusCondition = "AND se.status IN ('read', 'unread', 'Delivered', 'Sent', 'sent')";
                break;
            case 'unread':
                statusCondition = "AND se.status IN ('unread', 'sent', 'Sent', 'Delivered')";
                break;
            case 'archived':
                statusCondition = "AND se.status = 'archived'";
                break;
            case 'trash':
                statusCondition = "AND se.status = 'trashed'";
                break;
            default:
                statusCondition = "AND se.status IN ('read', 'unread')";
        }
        
        // Base query for received emails
        query = `
            SELECT 
                se.*,
                CASE 
                    WHEN se.sender = ? THEN 'sent'
                    WHEN se.recipient = ? THEN 'received'
                    ELSE 'other'
                END as direction,
                EXISTS(SELECT 1 FROM email_read_receipts err WHERE err.email_id = se.id AND err.user_email = ?) as is_read_by_me
            FROM sent_emails se
            WHERE (se.recipient = ?)
            ${statusCondition}
        `;
        
        params = [userEmail, userEmail, userEmail, userEmail];
        
        // Add search if provided
        if (search) {
            query += ` AND (se.subject LIKE ? OR se.body LIKE ? OR se.sender LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
    }

    query += ` ORDER BY se.sent_at DESC`;

 

    const [rows] = await dbPromise.query(query, params);
    return rows;
}

// Helper function to get email details with CC, BCC, and attachments
async function getEmailDetails(emailId) {
    const [email] = await dbPromise.query(
        "SELECT * FROM sent_emails WHERE id = ?",
        [emailId]
    );

    if (email.length === 0) return null;

    const [cc] = await dbPromise.query(
        "SELECT cc_email FROM email_cc WHERE email_id = ?",
        [emailId]
    );

    const [bcc] = await dbPromise.query(
        "SELECT bcc_email FROM email_bcc WHERE email_id = ?",
        [emailId]
    );

    const [attachments] = await dbPromise.query(
        "SELECT id, file_name, file_path, file_size, mime_type FROM email_attachments WHERE email_id = ?",
        [emailId]
    );

    return {
        ...email[0],
        cc: cc.map(c => c.cc_email),
        bcc: bcc.map(b => b.bcc_email),
        attachments
    };
}

// GET /api/messages - Get all messages for the logged-in user
router.get("/", AuthorLoggedIn, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const { folder = 'inbox', search = '' } = req.query;

        const emails = await getUserEmails(userEmail, folder, search);

        res.json({
            status: "success",
            emails,
            count: emails.length,
            folder
        });

    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to fetch messages"
        });
    }
});

// GET /api/messages/counts - Get message counts for all folders
router.get("/counts", AuthorLoggedIn, async (req, res) => {
    try {
        const userEmail = req.user.email;

        const [inbox] = await dbPromise.query(
            "SELECT COUNT(*) as count FROM sent_emails WHERE (sender = ? OR recipient = ?) AND status IN ('read', 'unread', 'sent', 'Delivered')",
            [userEmail, userEmail]
        );

        const [unread] = await dbPromise.query(
            "SELECT COUNT(*) as count FROM sent_emails WHERE (recipient = ?) AND status IN ('unread', 'sent', 'Sent', 'Delivered')",
            [userEmail, userEmail]
        );

        const [archived] = await dbPromise.query(
            "SELECT COUNT(*) as count FROM sent_emails WHERE (sender = ? OR recipient = ?) AND status = 'archived'",
            [userEmail, userEmail]
        );

        const [trash] = await dbPromise.query(
            "SELECT COUNT(*) as count FROM sent_emails WHERE (sender = ? OR recipient = ?) AND status = 'trashed'",
            [userEmail, userEmail]
        );

        const [sent] = await dbPromise.query(
            "SELECT COUNT(*) as count FROM sent_emails WHERE sender = ? AND status IN ('unread', 'sent', 'Sent', 'Delivered')",
            [userEmail]
        );

        res.json({
            status: "success",
            counts: {
                inbox: inbox[0].count,
                unread: unread[0].count,
                archived: archived[0].count,
                trash: trash[0].count,
                sent: sent[0].count
            }
        });

    } catch (error) {
        console.error("Error fetching message counts:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to fetch message counts"
        });
    }
});

// GET /api/messages/:id - Get a specific message by ID
router.get("/:id", AuthorLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;
        const userEmail = req.user.email;

        const emailDetails = await getEmailDetails(id);

        if (!emailDetails) {
            return res.status(404).json({
                status: "error",
                message: "Message not found"
            });
        }

        // Check if user has access to this email
        if (emailDetails.sender !== userEmail && emailDetails.recipient !== userEmail) {
            // Check CC and BCC
            const [ccMatch] = await dbPromise.query(
                "SELECT id FROM email_cc WHERE email_id = ? AND cc_email = ?",
                [id, userEmail]
            );
            
            const [bccMatch] = await dbPromise.query(
                "SELECT id FROM email_bcc WHERE email_id = ? AND bcc_email = ?",
                [id, userEmail]
            );

            if (ccMatch.length === 0 && bccMatch.length === 0) {
                return res.status(403).json({
                    status: "error",
                    message: "You don't have permission to view this message"
                });
            }
        }

        // Mark as read if recipient is viewing
        if (emailDetails.recipient === userEmail && emailDetails.status === 'unread') {
            await dbPromise.query(
                "UPDATE sent_emails SET status = 'read' WHERE id = ?",
                [id]
            );

            // Record read receipt
            await dbPromise.query(
                "INSERT INTO email_read_receipts (email_id, user_email) VALUES (?, ?) ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP",
                [id, userEmail]
            );
        }

        res.json({
            status: "success",
            email: emailDetails
        });

    } catch (error) {
        console.error("Error fetching message:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to fetch message"
        });
    }
});

// PUT /api/messages/:id/status - Update message status (read/unread/archived/trashed)
router.put("/:id/status", AuthorLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userEmail = req.user.email;

        if (!status || !['read', 'unread', 'archived', 'trashed'].includes(status)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid status. Must be one of: read, unread, archived, trashed"
            });
        }

        // Check if user has access to this email
        const [email] = await dbPromise.query(
            "SELECT id, sender, recipient FROM sent_emails WHERE id = ?",
            [id]
        );

        if (email.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Message not found"
            });
        }

        if (email[0].sender !== userEmail && email[0].recipient !== userEmail) {
            return res.status(403).json({
                status: "error",
                message: "You don't have permission to modify this message"
            });
        }

        await dbPromise.query(
            "UPDATE sent_emails SET status = ? WHERE id = ?",
            [status, id]
        );

        res.json({
            status: "success",
            message: `Message marked as ${status}`,
            emailId: id,
            newStatus: status
        });

    } catch (error) {
        console.error("Error updating message status:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to update message status"
        });
    }
});

// POST /api/messages/:id/star - Toggle star status (using a separate field if needed)
// Note: You might want to add a 'starred' column to the sent_emails table
router.post("/:id/star", AuthorLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;
        const userEmail = req.user.email;

        // Check if user has access
        const [email] = await dbPromise.query(
            "SELECT id, sender, recipient FROM sent_emails WHERE id = ?",
            [id]
        );

        if (email.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Message not found"
            });
        }

        if (email[0].sender !== userEmail && email[0].recipient !== userEmail) {
            return res.status(403).json({
                status: "error",
                message: "You don't have permission to modify this message"
            });
        }

        // Since there's no starred column, we'll use a separate table
        const [existing] = await dbPromise.query(
            "SELECT id FROM email_stars WHERE email_id = ? AND user_email = ?",
            [id, userEmail]
        );

        if (existing.length > 0) {
            await dbPromise.query(
                "DELETE FROM email_stars WHERE email_id = ? AND user_email = ?",
                [id, userEmail]
            );
        } else {
            await dbPromise.query(
                "INSERT INTO email_stars (email_id, user_email) VALUES (?, ?)",
                [id, userEmail]
            );
        }

        res.json({
            status: "success",
            message: existing.length > 0 ? "Message unstarred" : "Message starred",
            starred: existing.length === 0
        });

    } catch (error) {
        console.error("Error toggling star:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to toggle star status"
        });
    }
});

// POST /api/messages/bulk - Bulk operations on messages
router.post("/bulk", AuthorLoggedIn, async (req, res) => {
    try {
        const { action, messageIds } = req.body;
        const userEmail = req.user.email;

        if (!action || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid request. Action and messageIds array are required"
            });
        }

        let query = '';
        let params = [];

        switch(action) {
            case 'archive':
                query = "UPDATE sent_emails SET status = 'archived' WHERE id IN (?) AND (sender = ? OR recipient = ?)";
                params = [messageIds, userEmail, userEmail];
                break;
            case 'trash':
                query = "UPDATE sent_emails SET status = 'trashed' WHERE id IN (?) AND (sender = ? OR recipient = ?)";
                params = [messageIds, userEmail, userEmail];
                break;
            case 'restore':
                query = "UPDATE sent_emails SET status = 'read' WHERE id IN (?) AND (sender = ? OR recipient = ?) AND status = 'trashed'";
                params = [messageIds, userEmail, userEmail];
                break;
            case 'delete':
                // Permanent delete - only for trashed messages
                query = "DELETE FROM sent_emails WHERE id IN (?) AND (sender = ? OR recipient = ?) AND status = 'trashed'";
                params = [messageIds, userEmail, userEmail];
                break;
            case 'mark_read':
                query = "UPDATE sent_emails SET status = 'read' WHERE id IN (?) AND recipient = ? AND status = 'unread'";
                params = [messageIds, userEmail];
                break;
            case 'mark_unread':
                query = "UPDATE sent_emails SET status = 'unread' WHERE id IN (?) AND recipient = ?";
                params = [messageIds, userEmail];
                break;
            default:
                return res.status(400).json({
                    status: "error",
                    message: "Invalid action"
                });
        }

        const [result] = await dbPromise.query(query, params);

        res.json({
            status: "success",
            message: `Bulk operation '${action}' completed`,
            affectedRows: result.affectedRows
        });

    } catch (error) {
        console.error("Error performing bulk operation:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to perform bulk operation"
        });
    }
});

// DELETE /api/messages/:id - Permanent delete (only for trashed messages)
router.delete("/:id", AuthorLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;
        const userEmail = req.user.email;

        const [result] = await dbPromise.query(
            "DELETE FROM sent_emails WHERE id = ? AND (sender = ? OR recipient = ?) AND status = 'trashed'",
            [id, userEmail, userEmail]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: "error",
                message: "Message not found or not in trash"
            });
        }

        res.json({
            status: "success",
            message: "Message permanently deleted"
        });

    } catch (error) {
        console.error("Error deleting message:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to delete message"
        });
    }
});

// GET /api/messages/:id/attachments/:attachmentId - Download attachment
router.get("/:id/attachments/:attachmentId", AuthorLoggedIn, async (req, res) => {
    try {
        const { id, attachmentId } = req.params;
        const userEmail = req.user.email;

        // Check if user has access to the email
        const [email] = await dbPromise.query(
            "SELECT id, sender, recipient FROM sent_emails WHERE id = ?",
            [id]
        );

        if (email.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Message not found"
            });
        }

        if (email[0].sender !== userEmail && email[0].recipient !== userEmail) {
            // Check CC and BCC
            const [ccMatch] = await dbPromise.query(
                "SELECT id FROM email_cc WHERE email_id = ? AND cc_email = ?",
                [id, userEmail]
            );
            
            const [bccMatch] = await dbPromise.query(
                "SELECT id FROM email_bcc WHERE email_id = ? AND bcc_email = ?",
                [id, userEmail]
            );

            if (ccMatch.length === 0 && bccMatch.length === 0) {
                return res.status(403).json({
                    status: "error",
                    message: "You don't have permission to access this attachment"
                });
            }
        }

        const [attachment] = await dbPromise.query(
            "SELECT file_name, file_path FROM email_attachments WHERE id = ? AND email_id = ?",
            [attachmentId, id]
        );

        if (attachment.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Attachment not found"
            });
        }

        // Send file
        res.download(attachment[0].file_path, attachment[0].file_name);

    } catch (error) {
        console.error("Error downloading attachment:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to download attachment"
        });
    }
});

module.exports = router;