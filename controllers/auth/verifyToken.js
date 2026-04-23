// backend/controllers/auth/verifyToken.js
const db = require("../../routes/db.config");
const jwt = require("jsonwebtoken");

const verifyToken = async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ valid: false, message: "No token provided" });
    }

    try {
        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check both session tables
        const [authorSession] = await db.promise().query(
            "SELECT * FROM authors_session WHERE session_token = ? AND expires_at > NOW()",
            [token]
        );

        const [editorSession] = await db.promise().query(
            "SELECT * FROM editors_session WHERE session_token = ? AND expires_at > NOW()",
            [token]
        );

        // Determine which session is valid
        let validSession = null;
        let sessionType = null;

        if (authorSession.length > 0) {
            validSession = authorSession[0];
            sessionType = 'author';
        } else if (editorSession.length > 0) {
            validSession = editorSession[0];
            sessionType = 'editor';
        }

        if (!validSession) {
            return res.status(401).json({ 
                valid: false, 
                message: "Session expired or invalid" 
            });
        }

        // Update last activity in the appropriate session table
        if (sessionType === 'author') {
            await db.promise().query(
                "UPDATE authors_session SET last_activity = NOW() WHERE session_token = ?",
                [token]
            );
        } else {
            await db.promise().query(
                "UPDATE editors_session SET last_activity = NOW() WHERE session_token = ?",
                [token]
            );
        }

        // Get user details based on session type
        let userDetails = {};
        
        if (sessionType === 'author') {
            const [author] = await db.promise().query(
                "SELECT id, email, firstname, lastname, is_editor FROM authors_account WHERE id = ?",
                [decoded.id]
            );
            
            if (author.length > 0) {
                userDetails = {
                    id: author[0].id,
                    email: author[0].email,
                    role: author[0].is_editor === "yes" ? "editor" :"author",
                    firstName: author[0].firstname,
                    lastName: author[0].lastname
                };
            }
        } else {
            const [editor] = await db.promise().query(
                "SELECT id, email, firstname, lastname, editorial_level FROM editors WHERE email = ?",
                [decoded.email]
            );
            
            if (editor.length > 0) {
                userDetails = {
                    id: editor[0].id,
                    email: editor[0].email,
                    role: editor[0].editorial_level || 'editor',
                    firstName: editor[0].firstname,
                    lastName: editor[0].lastname
                };
            }
        }

        return res.json({ 
            valid: true, 
            user: userDetails,
            sessionType: sessionType
        });
    } catch (error) {
        console.error("Token verification error:", error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ valid: false, message: "Token expired" });
        }
        
        return res.status(401).json({ valid: false, message: "Invalid token" });
    }
};

module.exports = verifyToken;