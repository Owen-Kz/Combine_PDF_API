// backend/controllers/editors/AuthorsLogin.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const writeCookie = require("../../utils/writeCookie");
const db = require("../../../routes/db.config");
const dbPromise = require("../../../routes/dbPromise.config");

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
const AuthorsLogin = async (req, res) => {
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

    const query = "SELECT * FROM `authors_account` WHERE `email` = ? LIMIT 1";

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
        const accountStatus = user.account_status;

        // Handle PHP password hash format if needed
        if (storedHashedPassword && storedHashedPassword.startsWith('$2y$')) {
            storedHashedPassword = storedHashedPassword.replace('$2y$', '$2b$');
        }

        // Check account status
        if (accountStatus === 'unverified' || accountStatus === 'inactive') {
            return res.status(401).json({ 
                status: "error", 
                message: "This account is not verified. Please check your email for a verification link or contact the admin for assistance.",
                error_code: "ACCOUNT_UNVERIFIED"
            });
        }

        // Verify the password using bcrypt
        const isMatch = await bcrypt.compare(pass, storedHashedPassword);
        console.log("Password match:", isMatch);

        if (isMatch) {
            // Create JWT token with author data
            const token = jwt.sign(
                { 
                    id: user.id,
                    email: user.email,
                    role: 'author',
                    firstName: user.firstname,
                    lastName: user.lastname,
                    prefix: user.prefix || null,
                    orcidId: user.orcid_id || null,
                    discipline: user.discipline || null,
                    affiliations: user.affiliations || null,
                    affiliationCountry: user.affiliation_country || null,
                    affiliationCity: user.affiliation_city || null,
                    asfiMembershipId: user.asfi_membership_id || null,
                    isReviewer: user.is_reviewer || "no",
                    isEditor: user.is_editor || "no",
                    accountStatus: user.account_status || 'active',
                    dateJoined: user.date_joined || null
                }, 
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: process.env.JWT_EXPIRES || '7d' }
            );
            // Get client IP address
            const ip_add = req.headers['x-forwarded-for'] || 
                          req.connection.remoteAddress || 
                          req.socket.remoteAddress || 
                          'unknown';

            // Initialize editor data
            let editorData = [];
            let editorialLevel = "N/A";
            let editorialSection = null;

            // Check if user is an editor
            if (user.is_editor === "yes") {
                console.log("User is an editor, fetching editor details...");
                [editorData] = await dbPromise.query(
                    "SELECT * FROM editors WHERE email = ?", 
                    [user.email]
                );
              
                if (editorData.length > 0) {
                    console.log("Editor account found:", editorData[0].email);
                    editorialLevel = editorData[0].editorial_level || "sectional_editor";
                    editorialSection = editorData[0].editorial_section || null;
                    
                    // Create editor session
                    const EditorSessionQuery = `
                        INSERT INTO editors_session 
                        (editor_id, session_token, ip_address, user_agent, created_at, expires_at) 
                        VALUES ((SELECT id FROM editors WHERE email = ?), ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))
                    `;
                    await db.promise().query(EditorSessionQuery, [
                        user.email,
                        token, 
                        ip_add, 
                        req.headers['user-agent'] || 'unknown'
                    ]);
                }
            }
 
            // Create author session
            const AuthorSessionQuery = `
                INSERT INTO authors_session 
                (user_id, session_token, ip_address, user_agent, created_at, expires_at) 
                VALUES ((SELECT id FROM authors_account WHERE email = ?), ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))
            `;
            
            await db.promise().query(AuthorSessionQuery, [
                user.email,
                token, 
                ip_add, 
                req.headers['user-agent'] || 'unknown'
            ]);

            // Set cookies
            writeCookie(req, res, "asfirj_userRegistered", token);
            writeCookie(req, res, "author", user.id);

            // Determine role flags based on editorial level
            const isAdmin = editorialLevel === 'admin' || editorialLevel === 'administrator';
            const isEditorInChief = editorialLevel === 'editor-in-chief' || editorialLevel === 'editor_in_chief';
            const isAssociateEditor = editorialLevel === 'associate_editor' || editorialLevel === 'associate-editor';
            const isEditorialAssistant = editorialLevel === 'editorial_assistant' || editorialLevel === 'editorial-assistant';

            // Prepare comprehensive user data for frontend
            const userData = {
                // Basic user data
                id: user.id,
                email: user.email,
                firstName: user.firstname,
                lastName: user.lastname,
                fullname: `${user.prefix ? user.prefix + ' ' : ''}${user.firstname} ${user.lastname}`.trim(),
                role: user.is_editor === "yes" ? 'editor' : 'author',
                
                // Editor data (if exists)
                ...(editorData.length > 0 ? {
                    editorialLevel: editorialLevel,
                    editorialSection: editorialSection,
                    editorId: editorData[0].id,
                    editorFullname: editorData[0].fullname,
                    
                    // Role flags
                    isAdmin: isAdmin,
                    isEditorInChief: isEditorInChief,
                    isAssociateEditor: isAssociateEditor,
                    isEditorialAssistant: isEditorialAssistant,
                } : {
                    editorialLevel: editorialLevel,
                    editorialSection: editorialSection,
                    
                    // Role flags (all false for non-editors)
                    isAdmin: false,
                    isEditorInChief: false,
                    isAssociateEditor: false,
                    isEditorialAssistant: false,
                }),
                
                // Author profile data
                prefix: user.prefix || null,
                orcidId: user.orcid_id || null,
                discipline: user.discipline || null,
                affiliations: user.affiliations || null,
                affiliationCountry: user.affiliation_country || null,
                affiliationCity: user.affiliation_city || null,
                asfiMembershipId: user.asfi_membership_id || null,
                
                // Permissions
                canAccessAuthor: true,
                canAccessReviewer: user.is_reviewer === 'yes',
                canAccessEditor: user.is_editor === 'yes',
                canAccessAdmin: isAdmin || isEditorInChief, // Only admin and editor-in-chief can access admin features
                
                // Status
                isReviewer: user.is_reviewer === 'yes',
                isEditor: user.is_editor === 'yes',
                accountStatus: user.account_status || 'active'
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

module.exports = AuthorsLogin;