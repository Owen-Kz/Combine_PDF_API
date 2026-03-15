const db = require("../../../routes/db.config");

/**
 * Get invitation details for reviewers or editors including submission data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getInvitationDetails = async (req, res) => {
  try {
    const { articleId, email, token } = req.body;

    // Log incoming request for debugging
    console.log("=== GET INVITATION DETAILS REQUEST ===");
    console.log("Article ID:", articleId);
    console.log("Email:", email);
    console.log("Token:", token);

    // Validate required fields
    if (!articleId || !email || !token) {
      const missingFields = [];
      if (!articleId) missingFields.push('articleId');
      if (!email) missingFields.push('email');
      if (!token) missingFields.push('token');
      
      console.error("Missing required fields:", missingFields.join(', '));
      return res.status(400).json({ 
        success: false,
        error: "Missing required fields", 
        missingFields 
      });
    }

    // First, get the submission data
    console.log("Fetching submission data for ID:", articleId);
    
    const [submissionResults] = await db.promise().query(
      "SELECT * FROM `submissions` WHERE `revision_id` = ?",
      [articleId]
    );

    if (submissionResults.length === 0) {
      console.error("No submission found for ID:", articleId);
      return res.status(404).json({ 
        success: false, 
        error: "No submission data found" 
      });
    }

    const submission = submissionResults[0];
    console.log("Submission found:", submission.revision_id);

    // Get corresponding author details from authors_account
    console.log("Fetching author details for email:", submission.corresponding_authors_email);
    
    const [authorResults] = await db.promise().query(
      `SELECT 
        aa.*,
        CONCAT_WS(' ', 
          aa.prefix,
          aa.firstname,
          aa.lastname
        ) AS full_name
      FROM authors_account aa
      WHERE aa.email = ?`,
      [submission.corresponding_authors_email]
    );

    // Combine submission data with author details
    const articleData = {
      ...submission,
      corresponding_author_details: authorResults.length > 0 ? authorResults[0] : null,
      corresponding_author_fullname: authorResults.length > 0 
        ? authorResults[0].full_name || 
          `${authorResults[0].prefix || ''} ${authorResults[0].firstname || ''} ${authorResults[0].lastname || ''}`.trim()
        : submission.corresponding_author || '',
      corresponding_author_email: submission.corresponding_authors_email,
      corresponding_author_prefix: authorResults.length > 0 ? authorResults[0].prefix : null,
      corresponding_author_firstname: authorResults.length > 0 ? authorResults[0].firstname : null,
      corresponding_author_lastname: authorResults.length > 0 ? authorResults[0].lastname : null,
      corresponding_author_affiliation: authorResults.length > 0 ? authorResults[0].affiliations : null,
      corresponding_author_orcid: authorResults.length > 0 ? authorResults[0].orcid_id : null
    };

    // Parse authors if it's a JSON string
    let authors = [];
    try {
      authors = typeof submission.authors === 'string' 
        ? JSON.parse(submission.authors) 
        : submission.authors || [];
    } catch (e) {
      console.log("Error parsing authors JSON:", e.message);
      authors = [submission.corresponding_author || ''];
    }
    
    articleData.authors_list = authors;

    console.log("Submission data processed successfully");

    // Now check for invitation in invitations table for reviewers
    console.log("Checking for reviewer invitation...");

    const [reviewerInvitations] = await db.promise().query(
      `SELECT 
        i.*,
        e.fullname as invited_by_fullname,
        e.email as invited_by_email
       FROM invitations i
       LEFT JOIN editors e ON i.invited_user_name = e.email
       WHERE i.invitation_link = ? 
         AND i.invited_user = ? 
         AND (i.invitation_status = 'invite_sent' OR i.invitation_status = 'pending')
         AND i.invited_for = 'Submission Review'`,
      [articleId, email]
    );

    console.log(`Reviewer invitation query returned ${reviewerInvitations.length} results`);

    if (reviewerInvitations.length > 0) {
      const invitation = reviewerInvitations[0];
      console.log("Found reviewer invitation:", {
        id: invitation.id,
        status: invitation.invitation_status,
        invited_by: invitation.invited_user_name,
        date: invitation.invitation_date
      });

      return res.json({
        success: true,
        submission: articleData,
        invitation: {
          type: 'reviewer',
          invited_by: invitation.invited_user_name || 'Unknown',
          invited_by_name: invitation.invited_by_fullname || invitation.invited_user_name || 'Unknown',
          invited_at: invitation.invitation_date,
          expires_at: invitation.invitation_expiry_date,
          status: invitation.invitation_status,
          invitation_id: invitation.id
        }
      });
    }

    // Check in invitations table for editors
    console.log("No reviewer invitation found. Checking for editor invitation...");

    const [editorInvitations] = await db.promise().query(
      `SELECT 
        i.*,
        e.fullname as invited_by_fullname,
        e.email as invited_by_email
       FROM invitations i
       LEFT JOIN editors e ON i.invited_user_name = e.email
       WHERE i.invitation_link = ? 
         AND i.invited_user = ? 
         AND (i.invitation_status = 'invite_sent' OR i.invitation_status = 'pending')
         AND i.invited_for = 'To Edit'`,
      [articleId, email]
    );

    console.log(`Editor invitation query returned ${editorInvitations.length} results`);

    if (editorInvitations.length > 0) {
      const invitation = editorInvitations[0];
      console.log("Found editor invitation:", {
        id: invitation.id,
        status: invitation.invitation_status,
        invited_by: invitation.invited_user_name,
        date: invitation.invitation_date,
        expires: invitation.invitation_expiry_date
      });

      return res.json({
        success: true,
        submission: articleData,
        invitation: {
          type: 'editor',
          invited_by: invitation.invited_user_name || 'Unknown',
          invited_by_name: invitation.invited_by_fullname || invitation.invited_user_name || 'Unknown',
          invited_at: invitation.invitation_date,
          expires_at: invitation.invitation_expiry_date,
          status: invitation.invitation_status,
          invitation_id: invitation.id
        }
      });
    }

    // Check if invitation exists but is already processed
    console.log("No pending invitations found. Checking for processed invitations...");

    const [processedInvitations] = await db.promise().query(
      `SELECT invitation_status, invited_for 
       FROM invitations 
       WHERE invitation_link = ? AND invited_user = ?`,
      [articleId, email]
    );

    if (processedInvitations.length > 0) {
      const processed = processedInvitations[0];
      console.log("Found processed invitation with status:", processed.invitation_status);
      
      return res.status(400).json({
        success: false,
        message: `Invitation already ${processed.invitation_status === 'accepted' ? 'accepted' : 'processed'}`,
        status: processed.invitation_status,
        type: processed.invited_for === 'Submission Review' ? 'reviewer' : 'editor',
        submission: articleData
      });
    }

    // No invitation found
    console.error("No invitation found matching the criteria");
    console.log("Search criteria:", {
      invitation_link: articleId,
      invited_user: email,
      token: token
    });

    return res.status(404).json({ 
      success: false, 
      message: "Invitation not found. Please check the link and try again.",
      submission: articleData, // Still return submission data even if invitation not found
      debug: process.env.NODE_ENV === 'development' ? {
        articleId,
        email,
        token
      } : undefined
    });

  } catch (error) {
    console.error("=== ERROR IN GET INVITATION DETAILS ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    // Log database error details if available
    if (error.sql) {
      console.error("SQL Query:", error.sql);
      console.error("SQL Error Code:", error.code);
      console.error("SQL Error Number:", error.errno);
    }

    return res.status(500).json({ 
      success: false,
      error: "Internal server error", 
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = getInvitationDetails;