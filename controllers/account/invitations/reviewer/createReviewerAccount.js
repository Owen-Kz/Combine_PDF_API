// controllers/invitations/createReviewerAccount.js
const db = require("../../../../routes/db.config");
const bcrypt = require("bcryptjs");
const acceptReviewer = require("./acceptReviewer");
const { sendEmail } = require("../../../utils/sendEmail");

/**
 * Creates a reviewer account and processes the invitation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createReviewerAccount = async (req, res) => {
  let connection;
  
  try {
    // Log incoming request for debugging
    console.log("=== CREATE REVIEWER ACCOUNT REQUEST ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    // Extract fields from request body (matching frontend field names)
    const {
      prefix,
      firstName,      // Frontend sends firstName
      lastName,       // Frontend sends lastName
      otherName,      // Frontend sends otherName
      email,
      password,
      affiliation,    // Frontend sends affiliation
      affiliationCountry, // Frontend sends affiliationCountry
      affiliationCity,    // Frontend sends affiliationCity
      discipline,
      otherDiscipline,
      orcid,
      articleId,
      token,
      reviewAvailability,
      type
    } = req.body;

    // Log extracted fields (excluding password)
    console.log("Extracted fields:", {
      prefix,
      firstName,
      lastName,
      otherName,
      email,
      affiliation,
      affiliationCountry,
      affiliationCity,
      discipline,
      otherDiscipline,
      orcid,
      articleId,
      token,
      reviewAvailability,
      type
    });

    // Validate required fields
    const missingFields = [];
    if (!email) missingFields.push('email');
    if (!password) missingFields.push('password');
    if (!firstName) missingFields.push('firstName');
    if (!lastName) missingFields.push('lastName');
    if (!affiliation) missingFields.push('affiliation');
    if (!affiliationCountry) missingFields.push('affiliationCountry');
    if (!affiliationCity) missingFields.push('affiliationCity');
    if (!discipline) missingFields.push('discipline');
    if (!articleId) missingFields.push('articleId');
    if (!token) missingFields.push('token');

    if (missingFields.length > 0) {
      console.error("Missing required fields:", missingFields);
      return res.status(400).json({ 
        status: "error", 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("Invalid email format:", email);
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid email format" 
      });
    }

    // Validate password strength
    if (password.length < 8) {
      console.error("Password too short");
      return res.status(400).json({ 
        status: "error", 
        message: "Password must be at least 8 characters long" 
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      console.error("Password does not meet complexity requirements");
      return res.status(400).json({ 
        status: "error", 
        message: "Password must contain at least one uppercase letter, one lowercase letter, and one number" 
      });
    }

    // Establish database connection
    console.log("Establishing database connection...");
    connection = await db.promise();
    await connection.beginTransaction();
    console.log("Transaction started");

    // First, check if user already exists
    console.log("Checking if user already exists:", email);
    const [existingUser] = await connection.query(
      "SELECT email FROM authors_account WHERE email = ?",
      [email]
    );

    if (existingUser.length > 0) {
      console.error("User already exists:", email);
      await connection.rollback();
      return res.status(409).json({ 
        status: "error", 
        message: "An account with this email already exists. Please log in instead." 
      });
    }

    // Verify the invitation exists and is still valid
    console.log("Verifying invitation for:", { articleId, email });
    
    // Check in submitted_for_review table
    const [reviewerInvitation] = await connection.query(
      `SELECT * FROM submitted_for_review 
       WHERE article_id = ? AND reviewer_email = ? AND status = 'submitted_for_review'`,
      [articleId, email]
    );

    // Also check in invitations table
    const [invitationRecord] = await connection.query(
      `SELECT * FROM invitations 
       WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'Submission Review' 
       AND (invitation_status = 'invite_sent' OR invitation_status = 'pending')`,
      [articleId, email]
    );

    console.log("Invitation check results:", {
      reviewerInvitation: reviewerInvitation.length > 0 ? "Found" : "Not found",
      invitationRecord: invitationRecord.length > 0 ? "Found" : "Not found"
    });

    if (reviewerInvitation.length === 0 && invitationRecord.length === 0) {
      // Check if invitation exists but is already processed
      const [processedInvitation] = await connection.query(
        `SELECT invitation_status FROM invitations 
         WHERE invitation_link = ? AND invited_user = ?`,
        [articleId, email]
      );

      // if (processedInvitation.length > 0) {
      //   const status = processedInvitation[0].invitation_status;
      //   console.error("Invitation already processed with status:", status);
        
      //   let message = "This invitation has already been processed";
      //   if (status === 'accepted') message = "You have already accepted this invitation";
      //   if (status === 'rejected') message = "You have already declined this invitation";
      //   if (status === 'expired') message = "This invitation has expired";
        
      //   await connection.rollback();
      //   return res.status(400).json({ 
      //     status: "error", 
      //     message 
      //   });
      // }

      console.error("No valid invitation found");
      await connection.rollback();
      return res.status(403).json({ 
        status: "error", 
        message: "Invalid or expired invitation. Please check your invitation link." 
      });
    }

    // Hash password
    console.log("Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Password hashed successfully");

    // Handle discipline (if "Other" was selected)
    const finalDiscipline = discipline === 'Other' && otherDiscipline ? otherDiscipline : discipline;

    // Create author account
    console.log("Creating author account for:", email);
    const insertResult = await connection.query(
      `INSERT INTO authors_account 
       (prefix, email, orcid_id, discipline, firstname, lastname, othername, 
        affiliations, affiliation_country, affiliation_city, is_available_for_review, 
        is_reviewer, reviewer_invite_status, account_status, password) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prefix || '',
        email,
        orcid || '',
        finalDiscipline,
        firstName,
        lastName,
        otherName || '',
        affiliation,
        affiliationCountry,
        affiliationCity,
        reviewAvailability === 'yes' ? 'yes' : 'no',
        'yes', // is_reviewer
        'accepted', // reviewer_invite_status
        'verified', // account_status
        hashedPassword
      ]
    );

    console.log("Account created successfully. Insert ID:", insertResult[0]?.insertId || 'N/A');

    // Commit the transaction
    await connection.commit();
    console.log("Transaction committed successfully");

    // Now accept the invitation
    console.log("Proceeding to accept invitation...");
    
    // Create a new request object for acceptReviewer
    const acceptReq = {
      body: { articleId, email, token }
    };

    // Create a response object that we'll use to capture the acceptReviewer response
    let acceptResponse = null;
    const acceptRes = {
      status: (code) => ({
        json: (data) => {
          acceptResponse = { statusCode: code, data };
          return this;
        }
      }),
      json: (data) => {
        acceptResponse = { data };
        return this;
      }
    };

    // Call acceptReviewer
    await acceptReviewer(acceptReq, acceptRes);

    // Check if acceptReviewer was successful
    if (acceptResponse && acceptResponse.data && acceptResponse.data.status === 'success') {
      console.log("Invitation accepted successfully");
      
      return res.json({
        status: "success",
        message: "Account created and invitation accepted successfully",
        data: {
          email,
          articleId,
          redirectTo: '/login'
        }
      });
    } else {
      // If acceptReviewer failed but account was created
      console.error("Invitation acceptance failed after account creation:", acceptResponse?.data);
      
      return res.status(207).json({
        status: "partial_success",
        message: "Account created but invitation acceptance failed. Please try accepting the invitation again.",
        data: {
          email,
          articleId,
          requiresRetry: true
        }
      });
    }

  } catch (error) {
    // Rollback transaction on error
    if (connection) {
      try {
        await connection.rollback();
        console.log("Transaction rolled back due to error");
      } catch (rollbackError) {
        console.error("Error rolling back transaction:", rollbackError);
      }
    }

    // Comprehensive error logging
    console.error("=== ERROR IN CREATE REVIEWER ACCOUNT ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    // Log database error details if available
    if (error.code) {
      console.error("Error code:", error.code);
      console.error("Error errno:", error.errno);
      console.error("SQL State:", error.sqlState);
    }
    
    if (error.sql) {
      console.error("SQL Query:", error.sql);
      console.error("SQL Message:", error.sqlMessage);
    }

    // Check for specific error types
    if (error.code === 'ER_DUP_ENTRY') {
      // Duplicate entry error (email already exists)
      return res.status(409).json({ 
        status: "error", 
        message: "An account with this email already exists. Please log in instead." 
      });
    }

    if (error.code === 'ER_BAD_NULL_ERROR') {
      return res.status(400).json({ 
        status: "error", 
        message: "Required field cannot be null. Please check your information." 
      });
    }

    if (error.code === 'ER_NO_REFERENCED_ROW') {
      return res.status(400).json({ 
        status: "error", 
        message: "Invalid reference data. Please contact support." 
      });
    }

    // Generic error response
    return res.status(500).json({ 
      status: "error", 
      message: process.env.NODE_ENV === 'development' ? error.message : "An unexpected error occurred while creating your account. Please try again later."
    });
  }
};

module.exports = createReviewerAccount;