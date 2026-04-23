const db = require("../../routes/db.config");

const getInvitations = async (req, res) => {
    try {
        const { article_id } = req.body;

        let type = ""

        if(req.query.type === "edit"){
            type = "To Edit"
        }else{
            type = "Submission Review"
        }

        if (!article_id) {
            return res.status(400).json({ error: "Invalid Parameters" });
        }

        // Get invitations first
        const query = "SELECT * FROM `invitations` WHERE `invitation_link` = ? AND invited_for = ? ORDER BY `id` DESC";

        db.query(query, [article_id, type], async (error, results) => {
            if (error) {
                console.log(error)
                return res.status(500).json({ error: error.message });
            }

            if (results.length > 0) {
                // For each invitation, get reminder counts from review_reminders table
                const invitationsWithReminders = await Promise.all(
                    results.map(async (invitation) => {
                        try {
                            // Get reminder count for this reviewer and article
                            const [reminderResults] = await db.promise().query(
                                `SELECT 
                                    COUNT(*) as reminder_count,
                                    MAX(sent_at) as last_reminder,
                                    GROUP_CONCAT(reminder_number ORDER BY sent_at DESC) as reminder_numbers,
                                    MAX(days_overdue) as max_days_overdue
                                 FROM review_reminders 
                                 WHERE review_id = ? 
                                 AND article_id = ? 
                                 AND reviewer_email = ?`,
                                [invitation.id, article_id, invitation.invited_user]
                            );

                            // Get individual reminder details for the last 3 reminders
                            const [reminderDetails] = await db.promise().query(
                                `SELECT 
                                    reminder_number,
                                    reminder_type,
                                    sent_at,
                                    days_overdue,
                                    status
                                 FROM review_reminders 
                                 WHERE review_id = ? 
                                 AND article_id = ? 
                                 AND reviewer_email = ?
                                 ORDER BY sent_at DESC
                                 LIMIT 3`,
                                [invitation.id, article_id, invitation.invited_user]
                            );

                            // Calculate if review is overdue (assuming 30-day deadline from invitation_date)
                            let isOverdue = false;
                            let daysOverdue = 0;
                            
                            if (invitation.invitation_date) {
                                const invitationDate = new Date(invitation.invitation_date);
                                const dueDate = new Date(invitationDate);
                                dueDate.setDate(dueDate.getDate() + 30); // 30-day deadline
                                
                                const today = new Date();
                                if (today > dueDate) {
                                    isOverdue = true;
                                    daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
                                }
                            }

                            return {
                                ...invitation,
                                reminder_count: reminderResults[0]?.reminder_count || 0,
                                last_reminder: reminderResults[0]?.last_reminder || null,
                                reminder_numbers: reminderResults[0]?.reminder_numbers ? 
                                    reminderResults[0].reminder_numbers.split(',').map(Number) : [],
                                max_days_overdue: reminderResults[0]?.max_days_overdue || 0,
                                recent_reminders: reminderDetails || [],
                                is_overdue: isOverdue,
                                days_overdue: daysOverdue,
                                // Add a flag for urgent reminders (3+ reminders sent)
                                is_urgent: (reminderResults[0]?.reminder_count || 0) >= 3,
                                // Add reminder level based on count
                                reminder_level: (reminderResults[0]?.reminder_count || 0) === 0 ? 'none' :
                                               (reminderResults[0]?.reminder_count || 0) === 1 ? 'first' :
                                               (reminderResults[0]?.reminder_count || 0) === 2 ? 'second' : 'final'
                            };
                        } catch (reminderError) {
                            console.error('Error fetching reminder counts:', reminderError);
                            return {
                                ...invitation,
                                reminder_count: 0,
                                last_reminder: null,
                                reminder_numbers: [],
                                max_days_overdue: 0,
                                recent_reminders: [],
                                is_overdue: false,
                                days_overdue: 0,
                                is_urgent: false,
                                reminder_level: 'none'
                            };
                        }
                    })
                );

                return res.json({ 
                    success: "Review Available", 
                    reviews: invitationsWithReminders 
                });
            } else {
                return res.json({ error: "No review invitations have been sent" });
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};

module.exports = getInvitations;