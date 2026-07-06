const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const writeCookie = require("../../utils/writeCookie");
const db = require("../../../routes/db.config");
const dbPromise = require("../../../routes/dbPromise.config");

const MAX_RETRIES = 4;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, context = "query") {
    let lastError;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (err.code === 'ER_LOCK_WAIT_TIMEOUT' || err.code === 'ER_LOCK_DEADLOCK') {
                const delay = Math.min(100 * Math.pow(2, attempt), 2000);
                console.warn(`${context} attempt ${attempt + 1}/${MAX_RETRIES} failed (${err.code}), retrying in ${delay}ms`);
                await sleep(delay);
                continue;
            }
            throw err;
        }
    }
    throw lastError;
}

async function killHangingTransactions() {
    try {
        const [processes] = await dbPromise.query("SHOW FULL PROCESSLIST");
        for (const p of processes) {
            if (p.Time > 30 && (p.Command === 'Query' || p.Command === 'Execute') && p.Info && p.Info.toLowerCase().includes('editors_session')) {
                console.warn(`Killing hanging transaction on connection ${p.Id} (time: ${p.Time}s)`);
                await dbPromise.query(`KILL CONNECTION ${p.Id}`).catch(e => {});
            }
        }
    } catch (err) {
        console.error("Error killing hanging transactions:", err.message);
    }
}

const verifyRecaptcha = async (token) => {
    console.log("Verifying reCAPTCHA token:", token ? "Token present" : "No token");
    
    try {
        const TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';
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
        
        if (response.data.success) {
            return true;
        } else {
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
        const [results] = await dbPromise.query(query, [email]);

        if (results.length === 0) {
            console.log("User not found for email:", email);
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

        if (storedHashedPassword && storedHashedPassword.startsWith('$2y$')) {
            storedHashedPassword = storedHashedPassword.replace('$2y$', '$2b$');
        }

        if (accountStatus === 'unverified' || accountStatus === 'inactive') {
            return res.status(401).json({ 
                status: "error", 
                message: "This account is not verified. Please check your email for a verification link or contact the admin for assistance.",
                error_code: "ACCOUNT_UNVERIFIED"
            });
        }

        const isMatch = await bcrypt.compare(pass, storedHashedPassword);
        console.log("Password match:", isMatch);

        if (isMatch) {
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
                    affiliations: user.affiliations || user.affiliation || null,
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

            const ip_add = req.headers['x-forwarded-for'] || 
                          req.connection.remoteAddress || 
                          req.socket.remoteAddress || 
                          'unknown';

            let editorData = [];
            let editorialLevel = "N/A";
            let editorialSection = null;

            if (user.is_editor === "yes") {
                console.log("User is an editor, fetching editor details...");
                [editorData] = await withRetry(async () => {
                    return await dbPromise.query(
                        "SELECT * FROM editors WHERE email = ?", 
                        [user.email]
                    );
                }, "SELECT editor");

                if (editorData.length > 0) {
                    console.log("Editor account found:", editorData[0].email);
                    editorialLevel = editorData[0].editorial_level || "sectional_editor";
                    editorialSection = editorData[0].editorial_section || null;

                    await withRetry(async () => {
                        const editorId = editorData[0].id;
                        await dbPromise.query(
                            `INSERT IGNORE INTO editors_session 
                            (editor_id, session_token, ip_address, user_agent, created_at, expires_at) 
                            VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))
                            ON DUPLICATE KEY UPDATE session_token = VALUES(session_token),
                                ip_address = VALUES(ip_address),
                                user_agent = VALUES(user_agent),
                                expires_at = VALUES(expires_at)`,
                            [editorId, token, ip_add, req.headers['user-agent'] || 'unknown']
                        );
                    }, "INSERT editor session");
                }
            }

            await withRetry(async () => {
                const [authorRows] = await dbPromise.query(
                    "SELECT id FROM authors_account WHERE email = ? LIMIT 1",
                    [user.email]
                );
                if (authorRows.length === 0) return;
                const authorId = authorRows[0].id;
                await dbPromise.query(
                    `INSERT IGNORE INTO authors_session 
                    (user_id, session_token, ip_address, user_agent, created_at, expires_at) 
                    VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))
                    ON DUPLICATE KEY UPDATE session_token = VALUES(session_token),
                        ip_address = VALUES(ip_address),
                        user_agent = VALUES(user_agent),
                        expires_at = VALUES(expires_at)`,
                    [authorId, token, ip_add, req.headers['user-agent'] || 'unknown']
                );
            }, "INSERT author session");

            writeCookie(req, res, "asfirj_userRegistered", token);
            writeCookie(req, res, "author", user.id);

            const isAdmin = editorialLevel === 'admin' || editorialLevel === 'administrator';
            const isEditorInChief = editorialLevel === 'editor-in-chief' || editorialLevel === 'editor_in_chief';
            const isAssociateEditor = editorialLevel === 'associate_editor' || editorialLevel === 'associate-editor';
            const isEditorialAssistant = editorialLevel === 'editorial_assistant' || editorialLevel === 'editorial-assistant';

            const userData = {
                id: user.id,
                email: user.email,
                firstName: user.firstname,
                lastName: user.lastname,
                fullname: `${user.prefix ? user.prefix + ' ' : ''}${user.firstname} ${user.lastname}`.trim(),
                role: user.is_editor === "yes" ? 'editor' : 'author',
                
                ...(editorData.length > 0 ? {
                    editorialLevel: editorialLevel,
                    editorialSection: editorialSection,
                    editorId: editorData[0].id,
                    editorFullname: editorData[0].fullname,
                    
                    isAdmin: isAdmin,
                    isEditorInChief: isEditorInChief,
                    isAssociateEditor: isAssociateEditor,
                    isEditorialAssistant: isEditorialAssistant,
                } : {
                    editorialLevel: editorialLevel,
                    editorialSection: editorialSection,
                    
                    isAdmin: false,
                    isEditorInChief: false,
                    isAssociateEditor: false,
                    isEditorialAssistant: false,
                }),
                
                prefix: user.prefix || null,
                orcidId: user.orcid_id || null,
                discipline: user.discipline || null,
                affiliations: user.affiliations || null,
                affiliationCountry: user.affiliation_country || null,
                affiliationCity: user.affiliation_city || null,
                asfiMembershipId: user.asfi_membership_id || null,
                
                canAccessAuthor: true,
                canAccessReviewer: user.is_reviewer === 'yes',
                canAccessEditor: user.is_editor === 'yes',
                canAccessAdmin: isAdmin || isEditorInChief,
                
                isReviewer: user.is_reviewer === 'yes',
                isEditor: user.is_editor === 'yes',
                accountStatus: user.account_status || 'active'
            };
            
            
            
            return res.json({
                status: "success", 
                message: "Login Successful", 
                token: token,
                user: userData
            });
        } else {
            console.log("Invalid password for user:", email);
            return res.status(401).json({ 
                status: "error", 
                message: "Invalid email or password",
                error_code: "INVALID_CREDENTIALS"
            });
        }

    } catch (err) {
        console.error("Database or Bcrypt error:", err);
        killHangingTransactions();
        return res.status(500).json({ 
            status: "error", 
            message: "Internal server error",
            error_code: "SERVER_ERROR"
        });
    }
};

module.exports = AuthorsLogin;
