// backend/middleware/AuthorLoggedIn.js
const jwt = require("jsonwebtoken");
const dbPromise = require("../../routes/dbPromise.config");

// Helper function to fetch editor data with author association
const fetchEditorData = async (email, token) => {
  try {
    // Fetch editor details
    const [editorResults] = await dbPromise.query(
      `SELECT id, email, fullname, editorial_level, editorial_section
       FROM editors WHERE email = ?`,
      [email]
    );

    if (editorResults.length === 0) return null;

    const editorData = editorResults[0];

    // Fetch associated author data
    const [authorResults] = await dbPromise.query(
      `SELECT id as author_id, prefix, firstname, lastname, othername, orcid_id, 
              discipline, affiliations, affiliation_country, affiliation_city,
              is_available_for_review, is_editor, is_reviewer, editor_invite_status,
              reviewer_invite_status, account_status, asfi_membership_id, date_joined
       FROM authors_account WHERE email = ?`,
      [editorData.email]
    );

    // Determine role flags
    const isAdmin = ['admin', 'editor_in_chief', 'editor-in-chief'].includes(editorData.editorial_level);
    const isEditorInChief = ['editor-in-chief', 'editor_in_chief', 'editorial_assistant'].includes(editorData.editorial_level);
    const isAssociateEditor = ['associate_editor', 'sectional_editor'].includes(editorData.editorial_level);
    const isEditorialAssistant = ['editorial_assistant', 'editorial-assistant'].includes(editorData.editorial_level);

    const authorData = authorResults.length > 0 ? authorResults[0] : null;

    return {
      // Editor data
      id: editorData.id,
      email: editorData.email,
      fullname: editorData.fullname,
      editorialLevel: editorData.editorial_level,
      editorialSection: editorData.editorial_section,
      sessionType: 'editor',
      
      // Role flags
      isAdmin,
      isEditorInChief,
      isAssociateEditor,
      isEditorialAssistant,
      
      // Author data (if exists)
      ...(authorData && {
        authorId: authorData.author_id,
        prefix: authorData.prefix,
        authorFirstName: authorData.firstname,
        authorLastName: authorData.lastname,
        otherName: authorData.othername,
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
        
        // Permissions based on author data
        canAccessReviewer: authorData.is_reviewer === 'yes' || authorData.is_reviewer === 1,
        canAccessAuthor: true,
        canAccessAdmin: isAdmin || isEditorInChief,
      }),
      
      // Editor-only permissions
      canAccessEditorFeatures: true,
      canAccessAdminFeatures: isAdmin || isEditorInChief,
      canAccessAssociateFeatures: isAssociateEditor || isEditorInChief,
      
      // Editor metadata
      _meta: {
        hasAuthorAccount: !!authorData,
        authorAccountId: authorData?.author_id || null,
      }
    };
  } catch (error) {
    console.error("Error fetching editor data:", error);
    return null;
  }
};

// Helper function to fetch author data with editor association
const fetchAuthorData = async (id, email) => {
  try {
    const [authorResults] = await dbPromise.query(
      `SELECT id, email, prefix, firstname, lastname, othername, orcid_id, 
              discipline, affiliations, affiliation_country, affiliation_city,
              is_available_for_review, is_editor, is_reviewer, editor_invite_status,
              reviewer_invite_status, account_status, asfi_membership_id, date_joined
       FROM authors_account WHERE email = ?`,
      [email]
    );

    if (authorResults.length === 0) return null;

    const authorData = authorResults[0];
    let editorData = null;

    // Check if author is also an editor and fetch editor details
    if (authorData.is_editor === 'yes' || authorData.is_editor === 1) {
      const [editorResults] = await dbPromise.query(
        `SELECT editorial_level FROM editors WHERE email = ?`,
        [authorData.email]
      );
      
      if (editorResults.length > 0) {
        const editorialLevel = editorResults[0].editorial_level;
        editorData = {
          editorialLevel,
          isAdmin: ['admin', 'editor_in_chief', 'editor-in-chief'].includes(editorialLevel),
          isAssociateEditor: ['associate_editor', 'sectional_editor'].includes(editorialLevel),
          isEditorInChief: ['editor-in-chief', 'editor_in_chief', 'editorial_assistant'].includes(editorialLevel),
          isEditorialAssistant: ['editorial_assistant', 'editorial-assistant'].includes(editorialLevel),
        };
      }
    }

    const isAdmin = editorData?.isAdmin || false;
    const isAssociateEditor = editorData?.isAssociateEditor || false;
    const isEditorInChief = editorData?.isEditorInChief || false;

    return {
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
      isAdmin,
      isEditorInChief,
      isAssociateEditor,
      isEditorialAssistant: editorData?.isEditorialAssistant || false,
      
      // Permissions
      canAccessReviewer: authorData.is_reviewer === 'yes' || authorData.is_reviewer === 1,
      canAccessAuthor: true,
      canAccessEditor: isAdmin || isAssociateEditor || isEditorInChief,
      canAccessAdmin: isAdmin || isEditorInChief,
      canAccessAssociateFeatures: isAssociateEditor || isEditorInChief,
      
      // Editor metadata (if applicable)
      ...(editorData && {
        _editor: {
          editorialLevel: editorData.editorialLevel,
          hasEditorAccess: editorData.editorialLevel === "editor_in_chief" || editorData.editorialLevel === "editorial_assistant" ? true : false,
        }
      }),
      
      _meta: {
        hasEditorAccount: !!editorData,
        editorLevel: editorData?.editorialLevel || null,
      }
    };
  } catch (error) {
    console.error("Error fetching author data:", error);
    return null;
  }
};

// Main middleware
const AuthorLoggedIn = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Not authenticated - No token provided" });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: "Not authenticated - Empty token" });
    }
    
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: "Invalid token" });
      }
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: "Token expired" });
      }
      return res.status(401).json({ error: "Token verification failed" });
    }
    
    // Check both session tables in parallel
    const [editorSession, authorSession] = await Promise.all([
      dbPromise.query(
        "SELECT * FROM editors_session WHERE editor_id = ? AND session_token = ? AND expires_at > NOW()",
        [decoded.email, token]
      ),
      dbPromise.query(
        "SELECT * FROM authors_session WHERE user_id = ? AND session_token = ? AND expires_at > NOW()",
        [decoded.authorId || decoded.id, token]
      )
    ]);

    let userData = null;
    let sessionType = null;

    // Check editor session first
    if (editorSession[0]?.length > 0) {
      sessionType = 'editor';
      userData = await fetchEditorData(decoded.email, token);
    } 
    // Check author session
    else if (authorSession[0]?.length > 0) {
      sessionType = 'author';
      userData = await fetchAuthorData(decoded.authorId || decoded.id, decoded.email);
    }

    // If no valid session found
    if (!userData) {
      return res.status(401).json({ error: "Session expired or invalid" });
    }

    // Update last activity in the appropriate session table
    const sessionTable = sessionType === 'editor' ? 'editors_session' : 'authors_session';
    const sessionIdColumn = sessionType === 'editor' ? 'editor_id' : 'user_id';
    
    await dbPromise.query(
      `UPDATE ${sessionTable} SET last_activity = NOW() WHERE session_token = ? AND ${sessionIdColumn} = ?`,
      [token, sessionType === 'editor' ? decoded.email : decoded.id]
    );

    // Set user data in request object
    req.user = userData;
    
    // Log user authentication
    console.log(`${sessionType} authenticated: ${userData.email} (${userData.sessionType})`);
    if (userData._meta?.hasAuthorAccount) {
      console.log(`Associated author account: ${userData._meta.authorAccountId}`);
    }
 
    if (userData._meta?.hasEditorAccount) {
      console.log(`Associated editor account: ${userData._meta.editorLevel}`);
    }
    
    next();

  } catch (error) {
    console.error(" AuthorLoggedIn error:", error);
    return res.status(500).json({ error: "Authentication error", details: error.message });
  }
};

module.exports = AuthorLoggedIn;