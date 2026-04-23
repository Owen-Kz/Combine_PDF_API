// // backend/middleware/EditorLoggedIn.js
// const jwt = require("jsonwebtoken");
// const db = require("../../routes/db.config");

// const EditorLoggedIn = async (req, res, next) => {
//   try {
//     // Get token from Authorization header
//     const authHeader = req.headers.authorization;
    
//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//       console.log("No token in Authorization header");
//       return res.status(401).json({ error: "Not authenticated" });
//     }

//     const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
    
//     if (!token) {
//       return res.status(401).json({ error: "Not authenticated" });
//     }
 
//     // Verify JWT token
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
//     // Check if session exists in editors_session table
//     const [sessionResults] = await db.promise().query(
//       "SELECT * FROM editors_session WHERE editor_id = ? AND session_token = ? AND expires_at > NOW()",
//       [decoded.id, token]
//     );

//     if (sessionResults.length === 0) {
//       // Session expired or invalid
//       return res.status(401).json({ error: "Session expired" });
//     }

//     // Get editor details from editors table
//     const [userResults] = await db.promise().query(
//       `SELECT id, email, fullname, editorial_level, editorial_section 
//        FROM editors WHERE id = ?`,
//       [decoded.id]
//     );

//     if (userResults.length === 0) {
//       return res.status(401).json({ error: "User not found" });
//     }

//     const editorData = userResults[0];
    
//     // Also fetch author data if exists (using the same email)
//     const [authorResults] = await db.promise().query(
//       `SELECT id as author_id, prefix, firstname, lastname, othername, orcid_id, 
//               discipline, affiliations, affiliation_country, affiliation_city,
//               is_available_for_review, is_editor, is_reviewer, editor_invite_status,
//               reviewer_invite_status, account_status, asfi_membership_id, date_joined
//        FROM authors_account WHERE email = ?`,
//       [editorData.email]
//     );

//     // Combine editor and author data
//     const userData = {
//       // Editor data
//       id: editorData.id,
//       email: editorData.email,
//       fullname: editorData.fullname,
//       editorialLevel: editorData.editorial_level,
//       editorialSection: editorData.editorial_section,
//       role: 'admin',
      
//       // Author data (if exists)
//       ...(authorResults.length > 0 ? {
//         authorId: authorResults[0].author_id,
//         prefix: authorResults[0].prefix,
//         firstName: authorResults[0].firstname,
//         lastName: authorResults[0].lastname,
//         otherName: authorResults[0].othername,
//         orcidId: authorResults[0].orcid_id,
//         discipline: authorResults[0].discipline,
//         affiliations: authorResults[0].affiliations,
//         affiliationCountry: authorResults[0].affiliation_country,
//         affiliationCity: authorResults[0].affiliation_city,
//         isAvailableForReview: authorResults[0].is_available_for_review,
//         isEditor: authorResults[0].is_editor,
//         isReviewer: authorResults[0].is_reviewer,
//         editorInviteStatus: authorResults[0].editor_invite_status,
//         reviewerInviteStatus: authorResults[0].reviewer_invite_status,
//         accountStatus: authorResults[0].account_status,
//         asfiMembershipId: authorResults[0].asfi_membership_id,
//         dateJoined: authorResults[0].date_joined,
        
//         // Permissions based on author data
//         canAccessReviewer: authorResults[0].is_reviewer === 'yes' || authorResults[0].is_reviewer === 1,
//         canAccessAuthor: true, // Editors can always access author dashboard
//       } : {
//         // Default values if no author account
//         canAccessReviewer: false,
//         canAccessAuthor: true,
//       })
//     };

//     // Set combined user data in request object
//     req.user = userData;
    
//     console.log(`User authenticated: ${req.user.email} (Editor)`);
//     if (req.user.authorId) {
//       console.log(`Associated author account found: ID ${req.user.authorId}`);
//     }

//     next();

//   } catch (error) {
//     console.error("EditorLoggedIn error:", error);
    
//     if (error.name === 'JsonWebTokenError') {
//       return res.status(401).json({ error: "Invalid token" });
//     }
    
//     if (error.name === 'TokenExpiredError') {
//       return res.status(401).json({ error: "Token expired" });
//     }
    
//     return res.status(500).json({ error: "Authentication error" });
//   }
// };

// module.exports = EditorLoggedIn;