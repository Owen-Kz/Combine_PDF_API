// backend/middleware/AuthorLoggedIn.js
const jwt = require("jsonwebtoken");
const db = require("../../routes/db.config");
const dbPromise = require("../../routes/dbPromise.config");

const AuthorLoggedIn = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("No token in Authorization header");
      return res.status(401).json({ error: "Not authenticated" });
    }

    const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"
    
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }
 
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check both session tables
    const [editorSession] = await dbPromise.query(
      "SELECT * FROM editors_session WHERE editor_id = ? AND session_token = ? AND expires_at > NOW()",
      [decoded.email, token]
    );

    const [authorSession] = await dbPromise.query(
      "SELECT * FROM authors_session WHERE user_id = ? AND session_token = ? AND expires_at > NOW()",
      [decoded.authorId || decoded.id, token] // Use authorId if available, otherwise use id
    );

    let userData = null;
    let sessionType = null;

    // Check if editor session exists (editor logged in)
    if (editorSession.length > 0) {
      sessionType = 'editor';
      
      // Get editor details from editors table
      const [editorResults] = await dbPromise.query(
        `SELECT id, email, fullname, editorial_level, editorial_section
         FROM editors WHERE email = ?`,
        [decoded.email]
      );

      if (editorResults.length > 0) {
        const editorData = editorResults[0];
        
        // Also fetch author data if exists (using the same email)
        const [authorResults] = await dbPromise.query(
          `SELECT id as author_id, prefix, firstname, lastname, othername, orcid_id, 
                  discipline, affiliations, affiliation_country, affiliation_city,
                  is_available_for_review, is_editor, is_reviewer, editor_invite_status,
                  reviewer_invite_status, account_status, asfi_membership_id, date_joined
           FROM authors_account WHERE email = ?`,
          [editorData.email]
        );

        // Determine role based on editorial level
        const isAdmin = editorData.editorial_level === 'admin' || 
                       editorData.editorial_level === 'editor_in_chief';
        const isEditorInChief = editorData.editorial_level === 'editor-in-chief' || 
                               editorData.editorial_level === 'editor_in_chief'|| 
                               editorData.editorial_level === 'editorial_assistant';

        // Combine editor and author data
        userData = {
          // Editor data
          id: editorData.id,
          email: editorData.email,
          fullname: editorData.fullname,
          editorialLevel: editorData.editorial_level,
          editorialSection: editorData.editorial_section,
          sessionType: 'editor',
          
          // Role flags
          isAdmin: isAdmin,
          isEditorInChief: isEditorInChief,
          isAssociateEditor: editorData.editorial_level === 'associate_editor' || 
                            editorData.editorial_level === 'sectional_editor',
          isEditorialAssistant: editorData.editorial_level === 'editorial_assistant' || 
                               editorData.editorial_level === 'editorial-assistant',
          
          // Author data (if exists)
          ...(authorResults.length > 0 ? {
            authorId: authorResults[0].author_id,
            prefix: authorResults[0].prefix,
            authorFirstName: authorResults[0].firstname,
            authorLastName: authorResults[0].lastname,
            otherName: authorResults[0].othername,
            orcidId: authorResults[0].orcid_id,
            discipline: authorResults[0].discipline,
            affiliations: authorResults[0].affiliations,
            affiliationCountry: authorResults[0].affiliation_country,
            affiliationCity: authorResults[0].affiliation_city,
            isAvailableForReview: authorResults[0].is_available_for_review,
            isEditor: authorResults[0].is_editor,
            isReviewer: authorResults[0].is_reviewer,
            editorInviteStatus: authorResults[0].editor_invite_status,
            reviewerInviteStatus: authorResults[0].reviewer_invite_status,
            accountStatus: authorResults[0].account_status,
            asfiMembershipId: authorResults[0].asfi_membership_id,
            dateJoined: authorResults[0].date_joined,
            editorialLevel: editorData.editorial_level,
          
            // Permissions based on author data
            canAccessReviewer: authorResults[0].is_reviewer === 'yes' || authorResults[0].is_reviewer === 1,
            canAccessAuthor: true, // Editors can always access author dashboard
            canAccessAdmin: isAdmin || isEditorInChief, // Only admin and editor-in-chief can access admin features
          } : {
            // Default values if no author account
            canAccessReviewer: false,
            canAccessAuthor: true,
            canAccessAdmin: isAdmin || isEditorInChief,
          })
        };
        
        console.log(`Editor authenticated: ${userData.email} (Editor - ${editorData.editorial_level})`);
        if (userData.authorId) {
          console.log(`Associated author account found: ID ${userData.authorId}`);
        }
      }
    }
    // Check if author session exists (author logged in directly)
    else if (authorSession.length > 0) {
      sessionType = 'author';
      
      // Get author details from authors_account table
      const [authorResults] = await dbPromise.query(
        `SELECT id, email, prefix, firstname, lastname, othername, orcid_id, 
                discipline, affiliations, affiliation_country, affiliation_city,
                is_available_for_review, is_editor, is_reviewer, editor_invite_status,
                reviewer_invite_status, account_status, asfi_membership_id, date_joined
         FROM authors_account WHERE id = ?`,
        [decoded.id]
      );

      if (authorResults.length > 0) {
        const authorData = authorResults[0];
        
        userData = {
          // Author data
          id: authorData.id,
          email: authorData.email,
          prefix: authorData.prefix,
          firstName: authorData.firstname,
          lastName: authorData.lastname,
          otherName: authorData.othername,
          fullname: `${authorData.firstname} ${authorData.lastname}`,
          sessionType: 'author',
          orcidId: authorData.orcid_id,
          discipline: authorData.discipline,
          affiliations: authorData.affiliations,
          affiliationCountry: authorData.affiliation_country,
          affiliationCity: authorData.affiliation_city,
          isAvailableForReview: authorData.is_available_for_review,
          isEditor: authorData.is_editor,
          isReviewer: authorData.is_reviewer,
          editorInviteStatus: authorData.editor_invite_status,
          reviewerInviteStatus: authorData.reviewer_invite_status,
          accountStatus: authorData.account_status,
          asfiMembershipId: authorData.asfi_membership_id,
          dateJoined: authorData.date_joined,
          
          // Role flags
          isAdmin: false,
          isEditorInChief: false,
          isAssociateEditor: false,
          isEditorialAssistant: false,
          
          // Permissions
          canAccessReviewer: authorData.is_reviewer === 'yes' || authorData.is_reviewer === 1,
          canAccessAuthor: true,
          canAccessEditor: authorData.is_editor === 'yes' || authorData.is_editor === 1,
          canAccessAdmin: false, // Authors cannot access admin features
        };
        
        console.log(`Author authenticated: ${userData.email} (Author)`);
        if (userData.isEditor) {
          console.log(`User is also an editor: ${userData.isEditor}`);
        }
      }
    }

    // If no valid session found
    if (!userData) {
      console.log("No valid session found for token");
      return res.status(401).json({ error: "Session expired or invalid" });
    }

    // Update last activity in the appropriate session table
    if (sessionType === 'editor') {
      await dbPromise.query(
        "UPDATE editors_session SET last_activity = NOW() WHERE session_token = ?",
        [token]
      );
    } else {
      await dbPromise.query(
        "UPDATE authors_session SET last_activity = NOW() WHERE session_token = ?",
        [token]
      );
    }

    // Set user data in request object
    req.user = userData;
    
    next();

  } catch (error) {
    console.error("AuthorLoggedIn error:", error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expired" });
    }
    
    return res.status(500).json({ error: "Authentication error" });
  }
};

module.exports = AuthorLoggedIn;