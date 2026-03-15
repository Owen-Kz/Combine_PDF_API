// // backend/controllers/editors/getRecentSubmissions.js
// const db = require("../../routes/db.config");
// const isAdminAccount = require("./isAdminAccount");

// const getRecentSubmissions = async (req, res) => {
//     try {
//         const userId = req.user.id;
//         const { page = 1, limit = 10, search = '' } = req.query;
        
//         if (!userId) {
//             return res.json({ error: "Invalid Parameters" });
//         }

//         const offset = (page - 1) * limit;
//         const searchTerm = `%${search}%`;

//         // Check if user is admin
//         const isAdmin = await isAdminAccount(userId);

//         let query;
//         let countQuery;
//         let queryParams = [];

//         if (isAdmin) {
//             // Admin sees all submissions
//             query = `
//                 SELECT 
//                     s.id,
//                     s.revision_id,
//                     s.title,
//                     s.abstract,
//                     s.keywords,
//                     s.type,
//                     s.status,
//                     s.submitted_date,
//                     s.updated_at,
//                     s.is_women_in_science,
//                     s.corresponding_author,
//                     s.corresponding_email,
//                     s.files,
//                     a.firstname,
//                     a.lastname,
//                     a.email as author_email,
//                     a.orcid_id,
//                     a.affiliations,
//                     -- Reviewer invitations count
//                     (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND (invitation_status = 'accepted' OR invitation_status = 'review_invitation_accepted' OR invitation_status = 'review_submitted')) as accepted_reviewers,
//                     (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND invitation_status = 'declined') as declined_reviewers,
//                     (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND invitation_status = 'invite_sent') as pending_reviewers,
//                     -- Editor invitations count
//                     (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND (invitation_status = 'accepted' OR invitation_status = 'edit_invitation_accepted' OR invitation_status = 'edit_submitted')) as accepted_editors,
//                     (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND invitation_status = 'declined') as declined_editors,
//                     (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND invitation_status = 'invite_sent') as pending_editors
//                 FROM submissions s
//                 LEFT JOIN authors_account a ON s.author_id = a.id
//                 WHERE (s.title LIKE ? OR s.revision_id LIKE ? OR a.firstname LIKE ? OR a.lastname LIKE ?)
//                 ORDER BY s.submitted_date DESC
//                 LIMIT ? OFFSET ?
//             `;
            
//             queryParams = [searchTerm, searchTerm, searchTerm, searchTerm, parseInt(limit), parseInt(offset)];
            
//             countQuery = `
//                 SELECT COUNT(*) as total
//                 FROM submissions s
//                 LEFT JOIN authors_account a ON s.author_id = a.id
//                 WHERE (s.title LIKE ? OR s.revision_id LIKE ? OR a.firstname LIKE ? OR a.lastname LIKE ?)
//             `;
//             console.log("Admin account detected. Fetching all submissions.");
//             console.log("Executing query:", query);
//         } else {
//             // Non-admin editors see only submissions assigned to them
//             query = `
//                 SELECT 
//                     s.id,
//                     s.revision_id,
//                     s.title,
//                     s.abstract,
//                     s.keywords,
//                     s.type,
//                     s.status,
//                     s.submitted_date,
//                     s.updated_at,
//                     s.is_women_in_science,
//                     s.corresponding_author,
//                     s.corresponding_email,
//                     s.files,
//                     a.firstname,
//                     a.lastname,
//                     a.email as author_email,
//                     a.orcid_id,
//                     a.affiliations,
//                     -- Reviewer invitations count
//                     (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND (invitation_status = 'accepted' OR invitation_status = 'review_invitation_accepted' OR invitation_status = 'review_submitted')) as accepted_reviewers,
//                     (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND invitation_status = 'declined') as declined_reviewers,
//                     (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'Submission Review' AND invitation_status = 'invite_sent') as pending_reviewers,
//                     -- Editor invitations count
//                     (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND (invitation_status = 'accepted' OR invitation_status = 'edit_invitation_accepted' OR invitation_status = 'edit_submitted')) as accepted_editors,
//                     (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND invitation_status = 'declined') as declined_editors,
//                     (SELECT COUNT(*) FROM invitations WHERE invitation_link = s.revision_id AND invited_for = 'To Edit' AND invitation_status = 'invite_sent') as pending_editors
//                 FROM submissions s
//                 LEFT JOIN authors_account a ON s.author_id = a.id
//                 LEFT JOIN editor_assignments ea ON s.revision_id = ea.revision_id
//                 WHERE (s.title LIKE ? OR s.revision_id LIKE ? OR a.firstname LIKE ? OR a.lastname LIKE ?)
//                 AND ea.editor_id = ?
//                 ORDER BY s.submitted_date DESC
//                 LIMIT ? OFFSET ?
//             `;
            
//             queryParams = [searchTerm, searchTerm, searchTerm, searchTerm, userId, parseInt(limit), parseInt(offset)];
            
//             countQuery = `
//                 SELECT COUNT(*) as total
//                 FROM submissions s
//                 LEFT JOIN authors_account a ON s.author_id = a.id
//                 LEFT JOIN editor_assignments ea ON s.revision_id = ea.revision_id
//                 WHERE (s.title LIKE ? OR s.revision_id LIKE ? OR a.firstname LIKE ? OR a.lastname LIKE ?)
//                 AND ea.editor_id = ?
//             `;
//         }

//         // Execute main query
//         db.query(query, queryParams, (error, results) => {
//             if (error) {
//                 console.log(error);
//                 return res.status(500).json({ error: "Database error", message: error.message });
//             }

//             // Execute count query for pagination
//             const countParams = isAdmin ? 
//                 [searchTerm, searchTerm, searchTerm, searchTerm] : 
//                 [searchTerm, searchTerm, searchTerm, searchTerm, userId];

//             db.query(countQuery, countParams, (countError, countResults) => {
//                 if (countError) {
//                     console.log(countError);
//                     return res.status(500).json({ error: "Database error", message: countError.message });
//                 }

//                 const formattedResults = results.map(row => {
//                     // Parse files if it's a string
//                     let files = {};
//                     try {
//                         files = row.files ? JSON.parse(row.files) : {};
//                     } catch (e) {
//                         console.error("Error parsing files JSON:", e);
//                         files = {};
//                     }

//                     return {
//                         id: row.revision_id,
//                         title: row.title,
//                         date: new Date(row.submitted_date).toLocaleDateString('en-GB', { 
//                             day: 'numeric', 
//                             month: 'short', 
//                             year: 'numeric' 
//                         }),
//                         submittedDate: row.submitted_date,
//                         type: row.type,
//                         status: row.status,
//                         isWomenInScience: row.is_women_in_science === 1,
//                         authors: row.firstname && row.lastname ? `${row.firstname} ${row.lastname}` : (row.firstname || row.lastname || 'Unknown'),
//                         correspondingAuthor: row.corresponding_author,
//                         correspondingEmail: row.corresponding_email,
//                         abstract: row.abstract,
//                         keywords: row.keywords ? row.keywords.split(',').map(k => k.trim()) : [],
//                         reviewerInvitations: {
//                             accepted: row.accepted_reviewers || 0,
//                             declined: row.declined_reviewers || 0,
//                             pending: row.pending_reviewers || 0
//                         },
//                         editorInvitations: {
//                             accepted: row.accepted_editors || 0,
//                             declined: row.declined_editors || 0,
//                             pending: row.pending_editors || 0
//                         },
//                         files: files
//                     };
//                 });

//                 return res.json({
//                     success: true,
//                     submissions: formattedResults,
//                     total: countResults[0]?.total || 0,
//                     page: parseInt(page),
//                     limit: parseInt(limit)
//                 });
//             });
//         });

//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ error: "Server error", message: error.message });
//     }
// };

// module.exports = getRecentSubmissions;