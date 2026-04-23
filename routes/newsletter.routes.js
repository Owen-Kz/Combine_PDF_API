const express = require("express");
const dbPromise = require("./dbPromise.config");
const AuthorLoggedIn = require("../controllers/account/AuthorLoggedIn");
const isAdminAccount = require("../controllers/editors/isAdminAccount");
const { sendNewsletter } = require("../controllers/utils/sendEmail");
const router = express.Router();

// Helper function to convert Quill Delta to HTML
function quillDeltaToHTML(delta) {
    if (!delta || !delta.ops || !Array.isArray(delta.ops)) return '';

    let html = '';
    let listStack = [];
    let inParagraph = false;

    delta.ops.forEach(op => {
        let text = op.insert || '';
        
        // Handle newlines
        if (text === '\n') {
            while (listStack.length > 0) {
                const listType = listStack.pop();
                html += `</${listType}>`;
            }
            if (inParagraph) {
                html += '</p>';
                inParagraph = false;
            }
            return;
        }

        if (!text.trim() && text !== '\n') return;

        if (op.attributes) {
            let formattedText = text;
            
            if (op.attributes.bold) formattedText = `<strong>${formattedText}</strong>`;
            if (op.attributes.italic) formattedText = `<em>${formattedText}</em>`;
            if (op.attributes.underline) formattedText = `<u>${formattedText}</u>`;
            if (op.attributes.strike) formattedText = `<s>${formattedText}</s>`;
            if (op.attributes.link) formattedText = `<a href="${op.attributes.link}" target="_blank">${formattedText}</a>`;
            
            if (op.attributes.header) {
                const level = op.attributes.header;
                if (inParagraph) {
                    html += '</p>';
                    inParagraph = false;
                }
                while (listStack.length > 0) {
                    const listType = listStack.pop();
                    html += `</${listType}>`;
                }
                html += `<h${level}>${formattedText}</h${level}>`;
                return;
            }
            
            if (op.attributes.align) {
                if (inParagraph) {
                    html += '</p>';
                    inParagraph = false;
                }
                while (listStack.length > 0) {
                    const listType = listStack.pop();
                    html += `</${listType}>`;
                }
                html += `<div style="text-align: ${op.attributes.align}">${formattedText}</div>`;
                return;
            }

            if (op.attributes.list) {
                const listType = op.attributes.list === 'bullet' ? 'ul' : 'ol';
                
                if (inParagraph) {
                    html += '</p>';
                    inParagraph = false;
                }
                
                if (listStack.length === 0 || listStack[listStack.length - 1] !== listType) {
                    if (listStack.length > 0) {
                        html += `</${listStack.pop()}>`;
                    }
                    html += `<${listType}>`;
                    listStack.push(listType);
                }
                
                html += `<li>${formattedText}</li>`;
                return;
            }

            if (!inParagraph) {
                html += '<p>';
                inParagraph = true;
            }
            html += formattedText;
        } else {
            if (text.trim()) {
                if (!inParagraph) {
                    html += '<p>';
                    inParagraph = true;
                }
                html += text;
            }
        }
    });

    while (listStack.length > 0) {
        const listType = listStack.pop();
        html += `</${listType}>`;
    }

    if (inParagraph) {
        html += '</p>';
    }

    return html;
}

// GET /api/newsletter/subscribers - Get all newsletter subscribers
router.get("/subscribers", AuthorLoggedIn, async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ status: "error", error: "Unauthorized Access" });
        }

        const query = `SELECT * FROM news_letter_subscribers ORDER BY id DESC`;
        const [results] = await dbPromise.query(query);

        if (results.length > 0) {
            return res.json({ 
                status: "success", 
                success: "emailListFound", 
                emailList: results 
            });
        } else {
            return res.json({ 
                status: "error", 
                error: "NoEmailListFound", 
                emailList: [] 
            });
        }

    } catch (error) {
        console.error("Error fetching subscribers:", error);
        return res.status(500).json({ 
            status: "error", 
            error: error.message 
        });
    }
});

// POST /api/newsletter/subscriber - Add a new subscriber
router.post("/subscriber", AuthorLoggedIn, async (req, res) => {
    try {
        const userId = req.user.id;
        const { email } = req.body;

        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ status: "error", error: "Unauthorized Access" });
        }

        if (!email) {
            return res.status(400).json({ status: "error", error: "Email is required" });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ status: "error", error: "Invalid email format" });
        }

        // Check if email already exists
        const [existing] = await dbPromise.query(
            "SELECT id FROM news_letter_subscribers WHERE email = ?",
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ 
                status: "error", 
                error: "Email already subscribed" 
            });
        }

        const query = `INSERT INTO news_letter_subscribers (email, date_joined) VALUES (?, NOW())`;
        const [result] = await dbPromise.query(query, [email]);

        return res.json({ 
            status: "success", 
            success: "Subscriber added successfully",
            id: result.insertId
        });

    } catch (error) {
        console.error("Error adding subscriber:", error);
        return res.status(500).json({ 
            status: "error", 
            error: error.message 
        });
    }
});

// DELETE /api/newsletter/subscriber/:id - Delete a subscriber
router.delete("/subscriber/:id", AuthorLoggedIn, async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ status: "error", error: "Unauthorized Access" });
        }

        const query = `DELETE FROM news_letter_subscribers WHERE id = ?`;
        const [result] = await dbPromise.query(query, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                status: "error", 
                error: "Subscriber not found" 
            });
        }

        return res.json({ 
            status: "success", 
            success: "Subscriber deleted successfully" 
        });

    } catch (error) {
        console.error("Error deleting subscriber:", error);
        return res.status(500).json({ 
            status: "error", 
            error: error.message 
        });
    }
});

// GET /api/newsletter/history - Get email sending history
router.get("/history", AuthorLoggedIn, async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ status: "error", error: "Unauthorized Access" });
        }

        const query = `SELECT * FROM email_logs ORDER BY sent_at DESC`;
        const [results] = await dbPromise.query(query);

        return res.json({ 
            status: "success", 
            history: results 
        });

    } catch (error) {
        console.error("Error fetching email history:", error);
        return res.status(500).json({ 
            status: "error", 
            error: error.message 
        });
    }
});

// POST /api/newsletter/send - Send a newsletter
router.post("/send", AuthorLoggedIn, async (req, res) => {
    try {
        const userId = req.user.id;
        const { subject, content, recipients, recipientType, selectedIds } = req.body;

        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ status: "error", error: "Unauthorized Access" });
        }

        if (!subject) {
            return res.status(400).json({ status: "error", error: "Subject is required" });
        }

        if (!content) {
            return res.status(400).json({ status: "error", error: "Content is required" });
        }

        // Get recipient emails
        let recipientEmails = [];
        
        if (recipientType === 'all') {
            const [subscribers] = await dbPromise.query(
                "SELECT email FROM news_letter_subscribers"
            );
            recipientEmails = subscribers.map(s => s.email);
        } else if (recipientType === 'selected' && selectedIds && selectedIds.length > 0) {
            const [subscribers] = await dbPromise.query(
                "SELECT email FROM news_letter_subscribers WHERE id IN (?)",
                [selectedIds]
            );
            recipientEmails = subscribers.map(s => s.email);
        } else {
            return res.status(400).json({ 
                status: "error", 
                error: "No recipients specified" 
            });
        }

        if (recipientEmails.length === 0) {
            return res.status(400).json({ 
                status: "error", 
                error: "No valid recipients found" 
            });
        }

        // Parse content if it's a string (Quill Delta)
        let htmlContent = content;
        if (typeof content === 'string') {
            try {
                const parsed = JSON.parse(content);
                if (parsed.ops) {
                    htmlContent = quillDeltaToHTML(parsed);
                }
            } catch (e) {
                // Not JSON, use as is
                htmlContent = content;
            }
        } else if (content.ops) {
            htmlContent = quillDeltaToHTML(content);
        }

        // Send the newsletter
        const result = await sendNewsletter(
            recipientEmails,
            subject,
            htmlContent,
            'ASFI Research Journal'
        );

        return res.json({
            status: result.status,
            message: result.message,
            data: result.data
        });

    } catch (error) {
        console.error("Error sending newsletter:", error);
        return res.status(500).json({ 
            status: "error", 
            error: error.message 
        });
    }
});

// GET /api/newsletter/stats - Get newsletter statistics
router.get("/stats", AuthorLoggedIn, async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ status: "error", error: "Unauthorized Access" });
        }

        // Get total subscribers
        const [subscriberCount] = await dbPromise.query(
            "SELECT COUNT(*) as total FROM news_letter_subscribers"
        );

        // Get subscribers from last 30 days
        const [recentSubscribers] = await dbPromise.query(
            "SELECT COUNT(*) as recent FROM news_letter_subscribers WHERE date_joined > DATE_SUB(NOW(), INTERVAL 30 DAY)"
        );

        // Get email stats
        const [emailStats] = await dbPromise.query(`
            SELECT 
                COUNT(*) as totalSent,
                SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(recipient_count) as totalRecipients
            FROM email_logs
        `);

        // Get unique domains
        const [domains] = await dbPromise.query(`
            SELECT 
                SUBSTRING_INDEX(email, '@', -1) as domain,
                COUNT(*) as count
            FROM news_letter_subscribers
            GROUP BY domain
            ORDER BY count DESC
        `);

        return res.json({
            status: "success",
            stats: {
                totalSubscribers: subscriberCount[0].total,
                recentSubscribers: recentSubscribers[0].recent,
                totalSent: emailStats[0].totalSent || 0,
                successful: emailStats[0].successful || 0,
                failed: emailStats[0].failed || 0,
                totalRecipients: emailStats[0].totalRecipients || 0,
                domains: domains
            }
        });

    } catch (error) {
        console.error("Error fetching newsletter stats:", error);
        return res.status(500).json({ 
            status: "error", 
            error: error.message 
        });
    }
});

module.exports = router;