// backend/controllers/editors/EditorLogin.js
const db = require("../../routes/db.config");
const writeCookie = require("../utils/writeCookie");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const axios = require("axios");

// Verify reCAPTCHA token
const verifyRecaptcha = async (token) => {
    console.log("Verifying reCAPTCHA token:", token ? "Token present" : "No token");
    
    try {
        // Test secret key for development (always returns success)
        const TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';
        
        // Use environment variable or fallback to test key
        const secretKey = process.env.RECAPTCHA_SECRET_KEY || TEST_SECRET_KEY;
        
        console.log("Using reCAPTCHA secret key:", secretKey === TEST_SECRET_KEY ? "Test key" : "Production key");
        
        const response = await axios.post(
            'https://www.google.com/recaptcha/api/siteverify',
            null,
            {
                params: {
                    secret: secretKey,
                    response: token
                }
            }
        );
        
        console.log("reCAPTCHA API response:", response.data);
        
        // Check if verification was successful
        if (response.data.success) {
            return true;
        } else {
            // Log error codes for debugging
            console.error("reCAPTCHA verification failed with errors:", response.data['error-codes']);
            return false;
        }
    } catch (error) {
        console.error("reCAPTCHA verification error:", error.message);
        if (error.response) {
            console.error("reCAPTCHA error response:", error.response.data);
        }
        return false;
    }
};

// Login Route
const EditorLogin = async (req, res) => {
    const { email, pass, recaptchaToken } = req.body;

    console.log("Login attempt for email:", email);
    console.log("reCAPTCHA token received:", recaptchaToken ? "Yes" : "No");

    if (!email || !pass) {
        return res.status(400).json({ 
            status: "error", 
            message: "Fill all fields",
            error_code: "MISSING_FIELDS"
        });
    }

    // Verify reCAPTCHA (skip in development if needed)
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!isDevelopment) {
        if (!recaptchaToken) {
            return res.status(400).json({ 
                status: "error", 
                message: "Please complete reCAPTCHA verification",
                error_code: "MISSING_RECAPTCHA"
            });
        }

        const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
        if (!isRecaptchaValid) {
            return res.status(400).json({ 
                status: "error", 
                message: "reCAPTCHA verification failed. Please try again.",
                error_code: "INVALID_RECAPTCHA"
            });
        }
    } else {
        console.log("Skipping reCAPTCHA verification in development mode");
    }

    const query = "SELECT * FROM `editors` WHERE `email` = ? LIMIT 1";

    try {
        // Query the database for the user
        const [results] = await db.promise().query(query, [email]);

        if (results.length === 0) {
            console.log("User not found for email:", email);
            // Return 401 for user not found to prevent user enumeration
            return res.status(401).json({ 
                status: "error", 
                message: "Invalid email or password",
                error_code: "INVALID_CREDENTIALS"
            });
        }

        const user = results[0];
        console.log("User found:", user.email);

        let storedHashedPassword = user.password;

        // Handle PHP password hash format if needed
        if (storedHashedPassword && storedHashedPassword.startsWith('$2y$')) {
            storedHashedPassword = storedHashedPassword.replace('$2y$', '$2b$');
        }

        // Verify the password using bcrypt
        const isMatch = await bcrypt.compare(pass, storedHashedPassword);
        console.log("Password match:", isMatch);

        if (isMatch) {
            // Get client IP address
            const ip_add = req.headers['x-forwarded-for'] || 
                          req.connection.remoteAddress || 
                          req.socket.remoteAddress || 
                          'unknown';

            // Fetch author data from authors_account table
            const [authorResults] = await db.promise().query(
                "SELECT * FROM `authors_account` WHERE `email` = ? LIMIT 1", 
                [email]
            );

            let authorData = null;
            if (authorResults.length > 0) {
                authorData = authorResults[0];
                console.log("Author data found for email:", email);
            } else {
                console.log("No author data found for email:", email);
            }

            // Create JWT token with comprehensive user data
            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email,
                    role: 'admin',
                    position: user.editorial_level || 'sectional_editor',
                    firstName: user.first_name,
                    lastName: user.last_name,
                    // Include author data if available
                    authorId: authorData?.id || null,
                    prefix: authorData?.prefix || null,
                    orcidId: authorData?.orcid_id || null,
                    discipline: authorData?.discipline || null,
                    affiliations: authorData?.affiliations || null,
                    affiliationCountry: authorData?.affiliation_country || null,
                    affiliationCity: authorData?.affiliation_city || null,
                    asfiMembershipId: authorData?.asfi_membership_id || null,
                    isReviewer: authorData?.is_reviewer || "no",
                    isEditor: authorData?.is_editor || "no",
                    accountStatus: authorData?.account_status || 'active',
                    dateJoined: authorData?.date_joined || null
                }, 
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: process.env.JWT_EXPIRES || '7d' }
            );

            // Store session in editors_session table
            const sessionQuery = `
                INSERT INTO editors_session 
                (editor_id, session_token, ip_address, user_agent, created_at, expires_at) 
                VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))
            `;

            // Store session in authors_session table
            const AuthorSessionQuery = `
                INSERT INTO authors_session 
                (user_id, session_token, ip_address, user_agent, created_at, expires_at) 
                   VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))
            `;
            
            await db.promise().query(sessionQuery, [
                user.id, 
             token, 
                ip_add, 
                req.headers['user-agent'] || 'unknown'
            ]);

            // AUTHORS QUERY 
            await db.promise().query(AuthorSessionQuery, [
                              authorData?.id, 

                token, 
                ip_add, 
                req.headers['user-agent'] || 'unknown'
            ]);


            // Set cookies
            writeCookie(req, res, "asfirj_userRegistered", token);
            writeCookie(req, res, "editor", user.id);

            // Prepare comprehensive user data for frontend
            const userData = {
                // Editor data
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                fullname: user.fullname || `${user.first_name} ${user.last_name}`,
                role: 'admin',
                avatar: user.avatar || null,
                title: user.title || null,
                editorialLevel: user.editorial_level || 'sectional_editor',
                editorialSection: user.editorial_section || null,
                
                // Author data (if available)
                authorId: authorData?.id || null,
                prefix: authorData?.prefix || null,
                orcidId: authorData?.orcid_id || null,
                discipline: authorData?.discipline || null,
                affiliations: authorData?.affiliations || null,
                affiliationCountry: authorData?.affiliation_country || null,
                affiliationCity: authorData?.affiliation_city || null,
                asfiMembershipId: authorData?.asfi_membership_id || null,
                
                // Permissions
                canAccessAuthor: true, // Editor can always access author dashboard
                canAccessReviewer: authorData?.is_reviewer === 'yes',
                canAccessEditor: authorData?.is_editor === 'yes' || true, // Editor can access editor dashboard
                
                // Status
                isReviewer: authorData?.is_reviewer === 'yes',
                isEditor: authorData?.is_editor === 'yes',
                accountStatus: authorData?.account_status || 'active'
            };
            
            // Return success response
            return res.json({
                status: "success", 
                message: "Login Successful", 
                token: token,
                user: userData
            });
        } else {
            console.log("Invalid password for user:", email);
            // Return 401 for invalid password
            return res.status(401).json({ 
                status: "error", 
                message: "Invalid email or password",
                error_code: "INVALID_CREDENTIALS"
            });
        }

    } catch (err) {
        console.error("Database or Bcrypt error:", err);
        return res.status(500).json({ 
            status: "error", 
            message: "Internal server error",
            error_code: "SERVER_ERROR"
        });
    }
};

module.exports = EditorLogin;