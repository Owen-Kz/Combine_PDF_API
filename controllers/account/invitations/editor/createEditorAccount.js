// controllers/invitations/createEditorAccount.js
const db = require("../../../../routes/db.config");
const bcrypt = require("bcryptjs");
const acceptEditor = require("./acceptEditor");

/**
 * Creates an editor account and processes the invitation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createEditorAccount = async (req, res) => {
  let connection;
  
  try {
    // Log incoming request for debugging
    console.log("=== CREATE EDITOR ACCOUNT REQUEST ===");
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

    // First, check if user already exists in authors_account
    console.log("Checking if user already exists in authors_account:", email);
    const [existingAuthor] = await connection.query(
      "SELECT email FROM authors_account WHERE email = ?",
      [email]
    );

    if (existingAuthor.length > 0) {
      console.error("User already exists in authors_account:", email);
      await connection.rollback();
      return res.status(409).json({ 
        status: "error", 
        message: "An account with this email already exists. Please log in instead." 
      });
    }

    // Check if user already exists in editors table
    console.log("Checking if user already exists in editors table:", email);
    const [existingEditor] = await connection.query(
      "SELECT email FROM editors WHERE email = ?",
      [email]
    );

    if (existingEditor.length > 0) {
      console.error("User already exists in editors table:", email);
      await connection.rollback();
      return res.status(409).json({ 
        status: "error", 
        message: "An editor account with this email already exists. Please log in instead." 
      });
    }

    // Verify the invitation exists and is still valid
    console.log("Verifying editor invitation for:", { articleId, email });
    
    // Check in submitted_for_edit table
    const [editorInvitation] = await connection.query(
      `SELECT * FROM submitted_for_edit 
       WHERE article_id = ? AND editor_email = ? AND status = 'submitted_for_edit'`,
      [articleId, email]
    );

    // Also check in invitations table
    const [invitationRecord] = await connection.query(
      `SELECT * FROM invitations 
       WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'To Edit' 
       AND (invitation_status = 'invite_sent' OR invitation_status = 'pending')`,
      [articleId, email]
    );

    console.log("Invitation check results:", {
      editorInvitation: editorInvitation.length > 0 ? "Found" : "Not found",
      invitationRecord: invitationRecord.length > 0 ? "Found" : "Not found"
    });

    // if (editorInvitation.length === 0 && invitationRecord.length === 0) {
    //   // Check if invitation exists but is already processed
    //   const [processedInvitation] = await connection.query(
    //     `SELECT invitation_status FROM invitations 
    //      WHERE invitation_link = ? AND invited_user = ?`,
    //     [articleId, email]
    //   );

    //   if (processedInvitation.length > 0) {
    //     const status = processedInvitation[0].invitation_status;
    //     console.error("Invitation already processed with status:", status);
        
    //     let message = "This invitation has already been processed";
    //     if (status === 'accepted') message = "You have already accepted this invitation";
    //     if (status === 'rejected') message = "You have already declined this invitation";
    //     if (status === 'expired') message = "This invitation has expired";
        
    //     await connection.rollback();
    //     return res.status(400).json({ 
    //       status: "error", 
    //       message 
    //     });
    //   }

    //   console.error("No valid editor invitation found");
    //   await connection.rollback();
    //   return res.status(403).json({ 
    //     status: "error", 
    //     message: "Invalid or expired invitation. Please check your invitation link." 
    //   });
    // }

    // Hash password
    console.log("Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Password hashed successfully");

    // Handle discipline (if "Other" was selected)
    const finalDiscipline = discipline === 'Other' && otherDiscipline ? otherDiscipline : discipline;

    // Construct full name for editors table
    const fullName = [prefix, firstName, lastName, otherName]
      .filter(part => part && part.trim())
      .join(' ')
      .trim();

    console.log("Creating author account in authors_account for:", email);
    
    // Create author account
    const [authorInsertResult] = await connection.query(
      `INSERT INTO authors_account 
       (prefix, email, orcid_id, discipline, firstname, lastname, othername, 
        affiliations, affiliation_country, affiliation_city, is_available_for_review, 
        is_editor, editor_invite_status, account_status, password, is_reviewer) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        'yes', // is_editor
        'accepted', // editor_invite_status
        'verified', // account_status
        hashedPassword,
        'yes' // is_reviewer (set to yes for editors)
      ]
    );

    console.log("Author account created. Insert ID:", authorInsertResult?.insertId || 'N/A');

    // Create editor record in editors table
    console.log("Creating editor record in editors table for:", email);
    
    const [editorInsertResult] = await connection.query(
      `INSERT INTO editors
       (email, fullname, editorial_level, editorial_section, password, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        email,
        fullName,
        'sectional_editor', // Default editorial level for invited editors
        finalDiscipline,
        hashedPassword
      ]
    );

    console.log("Editor record created. Insert ID:", editorInsertResult?.insertId || 'N/A');

    // Commit the transaction
    await connection.commit();
    console.log("Transaction committed successfully");

    // Now accept the invitation
    console.log("Proceeding to accept editor invitation...");
    
    // Create a new request object for acceptEditor
    const acceptReq = {
      body: { articleId, email, token }
    };

    // Create a response object that we'll use to capture the acceptEditor response
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

    // Call acceptEditor
    await acceptEditor(acceptReq, acceptRes);

    // Check if acceptEditor was successful
    if (acceptResponse && acceptResponse.data && acceptResponse.data.status === 'success') {
      console.log("Editor invitation accepted successfully");
      
      return res.json({
        status: "success",
        message: "Editor account created and invitation accepted successfully",
        data: {
          email,
          articleId,
          redirectTo: '/login'
        }
      });
    } else {
      // If acceptEditor failed but account was created
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
    console.error("=== ERROR IN CREATE EDITOR ACCOUNT ===");
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
      // Check which table had the duplicate entry
      if (error.sqlMessage && error.sqlMessage.includes('authors_account')) {
        return res.status(409).json({ 
          status: "error", 
          message: "An author account with this email already exists. Please log in instead." 
        });
      } else if (error.sqlMessage && error.sqlMessage.includes('editors')) {
        return res.status(409).json({ 
          status: "error", 
          message: "An editor account with this email already exists. Please log in instead." 
        });
      } else {
        return res.status(409).json({ 
          status: "error", 
          message: "An account with this email already exists. Please log in instead." 
        });
      }
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

    if (error.code === 'ER_DATA_TOO_LONG') {
      return res.status(400).json({ 
        status: "error", 
        message: "One or more fields exceed maximum length. Please check your information." 
      });
    }

    // Generic error response
    return res.status(500).json({ 
      status: "error", 
      message: process.env.NODE_ENV === 'development' ? error.message : "An unexpected error occurred while creating your account. Please try again later."
    });
  }
};

module.exports = createEditorAccount;