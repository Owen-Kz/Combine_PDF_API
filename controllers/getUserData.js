const db = require("../routes/db.config");
const dbPromise = require("../routes/dbPromise.config");

const getUserData = async (req, res, next) => {
    try {
        const userID = req.query._uid || req.user?.id;
        
        // Initialize empty user object if no ID provided
        if (!userID) {
            req.user = {};
            req.session.user = { authenticated: false };
            return next();
        }

        // Fetch user data from database
        const [data] = await dbPromise.query(
            "SELECT * FROM authors_account WHERE email = ? OR md5(id) = ?", 
            [userID, userID]
        );

        if (data && data.length > 0) {
            const user = data[0];
            
            // Store user data in request and session
            req.user = user;
            req.session.user = {
                id: user.id,
                email: user.email,
                firstname: user.firstname,
                lastname: user.lastname,
                authenticated: true,
                lastLogin: new Date()
            };

            // Initialize manuscript session if doesn't exist
            req.manuscriptData = req.manuscriptData || {
                sessionID: req.session.articleId || ""
            };
        } else {
            req.user = {};
            req.session.user = { authenticated: false };
        }

        next();
    } catch (error) {
        console.error("User authentication error:", error);
        
        // Ensure we always have user objects
        req.user = {};
        req.session.user = req.session.user || { authenticated: false };
        
        next(); // Continue to next middleware even if auth failed
    }
};

module.exports = getUserData;