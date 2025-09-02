const db = require("../routes/db.config");
const dbPromise = require("../routes/dbPromise.config");

// Consistent retry function with other modules
async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            console.log(`Operation attempt ${attempt}/${maxRetries} failed:`, error.message);
            
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                const jitter = delay * 0.1 * (Math.random() * 2 - 1);
                const totalDelay = Math.max(100, delay + jitter);
                
                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
        }
    }
    
    throw lastError;
}

const getUserData = async (req, res, next) => {
    try {
        const userID = req.query._uid || req.user?.id || req.session.user?.id;
        
        // Initialize empty user object if no ID provided
        if (!userID) {
            req.user = {};
            req.session.user = req.session.user || { authenticated: false };
            return next();
        }

        // Fetch user data from database with retry logic
        try {
            const [data] = await retryWithBackoff(async () => {
                return await dbPromise.query(
                    "SELECT * FROM authors_account WHERE email = ? OR md5(id) = ? OR id = ?", 
                    [userID, userID, userID]
                );
            }, 2, 500); // 2 retries with 500ms base delay

            if (data && data.length > 0) {
                const user = data[0];
                
                // Store user data in request and session
                req.user = user;
                req.session.user = {
                    id: user.id,
                    email: user.email,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    othername: user.othername,
                    prefix: user.prefix,
                    orcid_id: user.orcid_id,
                    discipline: user.discipline,
                    affiliations: user.affiliations,
                    affiliation_country: user.affiliation_country,
                    affiliation_city: user.affiliation_city,
                    asfi_membership_id: user.asfi_membership_id,
                    authenticated: true,
                    lastLogin: new Date()
                };

                // Initialize manuscript session if doesn't exist
                if (!req.session.manuscriptData) {
                    req.session.manuscriptData = {
                        sessionID: req.session.articleId || "",
                        manFile: false,
                        covFile: false,
                        KeyCount: 0,
                        process: "new"
                    };
                }

                // Ensure articleId is set if we have a session ID
                if (req.session.manuscriptData.sessionID && !req.session.articleId) {
                    req.session.articleId = req.session.manuscriptData.sessionID;
                }

            } else {
                // User not found, but maintain session if it exists
                req.user = {};
                if (!req.session.user) {
                    req.session.user = { authenticated: false };
                }
            }

        } catch (dbError) {
            console.error("Database error in getUserData:", dbError);
            // Continue with empty user but preserve existing session
            req.user = {};
            if (!req.session.user) {
                req.session.user = { authenticated: false };
            }
        }

        next();
    } catch (error) {
        console.error("Unexpected error in getUserData:", error);
        
        // Ensure we always have basic user objects
        req.user = {};
        req.session.user = req.session.user || { authenticated: false };
        
        next(); // Always continue to next middleware
    }
};

module.exports = getUserData;