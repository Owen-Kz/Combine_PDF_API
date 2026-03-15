// controllers/auth/authors/signup.js
const db = require("../../../routes/db.config");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("../../utils/sendEmail");
/**
 * Creates a new author account with email verification
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const AuthorSignup = async (req, res) => {
  let connection;
  
  try {
    // Log incoming request for debugging
    console.log("=== AUTHOR SIGNUP REQUEST ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    // Extract fields from request body
    const {
      prefix,
      firstName,
      lastName,
      otherName,
      email,
      password,
      affiliation,
      affiliationCountry,
      affiliationCity,
      discipline,
      orcid,
      reviewAvailability,
      recaptchaToken
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
      orcid,
      reviewAvailability,
      recaptchaToken: recaptchaToken ? "Present" : "Not present"
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

    // Verify reCAPTCHA (implement if needed)
    // const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
    // if (!isRecaptchaValid) {
    //   return res.status(400).json({ 
    //     status: "error", 
    //     message: "reCAPTCHA verification failed" 
    //   });
    // }

    // Establish database connection
    console.log("Establishing database connection...");
    connection = await db.promise();
    await connection.beginTransaction();
    console.log("Transaction started");

    // Check if user already exists
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

    // Hash password
    console.log("Hashing password...");
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Password hashed successfully");

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24); // Token valid for 24 hours

    console.log("Generated verification token");

    // Create author account with unverified status
    console.log("Creating author account for:", email);
    const insertResult = await connection.query(
      `INSERT INTO authors_account 
       (prefix, email, orcid_id, discipline, firstname, lastname, othername, 
        affiliations, affiliation_country, affiliation_city, is_available_for_review, 
        is_reviewer, account_status, password, verification_token, token_expiry, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        prefix || '',
        email,
        orcid || '',
        discipline,
        firstName,
        lastName,
        otherName || '',
        affiliation,
        affiliationCountry,
        affiliationCity,
        reviewAvailability === 'yes' ? 'yes' : 'no',
        reviewAvailability === 'yes' ? 'yes' : 'no',
        'unverified', // account_status
        hashedPassword,
        verificationToken,
        tokenExpiry
      ]
    );

    console.log("Account created successfully. Insert ID:", insertResult[0]?.insertId || 'N/A');

    // Commit the transaction
    await connection.commit();
    console.log("Transaction committed successfully");

    // Send verification email
    console.log("Sending verification email to:", email);
    
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - ASFI Research Journal</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(to right, #250242, #550f4f); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 30px; background: #8a1e78; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .button:hover { background: #6a175e; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Welcome to ASFI Research Journal</h2>
        </div>
        <div class="content">
          <p>Dear ${firstName} ${lastName},</p>
          
          <p>Thank you for registering with ASFI Research Journal. Please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center;">
            <a href="${verificationLink}" class="button">Verify Email Address</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationLink}</p>
          
          <p>This link will expire in 24 hours.</p>
          
          <p>If you did not create an account with us, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} ASFI Research Journal. All rights reserved.</p>
          <p style="font-size: 0.8em;">This is an automated message, please do not reply.</p>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: email,
      subject: "Verify Your Email - ASFI Research Journal",
      htmlContent: emailHtml,
      fromName: "ASFI Research Journal"
    });

    console.log("Verification email sent successfully");

    return res.json({
      status: "success",
      message: "Registration successful! Please check your email to verify your account.",
      data: {
        email,
        requiresVerification: true
      }
    });

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
    console.error("=== ERROR IN AUTHOR SIGNUP ===");
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

    // Generic error response
    return res.status(500).json({ 
      status: "error", 
      message: process.env.NODE_ENV === 'development' ? error.message : "An unexpected error occurred while creating your account. Please try again later."
    });
  }
};

module.exports = AuthorSignup;