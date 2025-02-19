const db = require("../../routes/db.config");
const writeCookie = require("../utils/writeCookie");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Login Route
const EditorLogin = async (req, res) => {
    const { email, pass } = req.body;

    if (!email || !pass) {
        return res.status(400).json({ status: "error", message: "Fill all fields" });
    }

    const query = "SELECT * FROM `editors` WHERE `email` = ? LIMIT 1";

    try {
        // Query the database for the user
        const [results] = await db.promise().query(query, [email]);

        if (results.length === 0) {
            return res.status(404).json({ status: "error", message: "User not found" });
        }

        const user = results[0];
        let storedHashedPassword = user.password;

        if (storedHashedPassword.startsWith('$2y$')) {
            storedHashedPassword = storedHashedPassword.replace('$2y$', '$2b$');
        }

        const saltRounds = 10; // You can adjust the cost factor (higher = more time-consuming)
        const hashedPassword = await bcrypt.hash(pass, saltRounds);
        

        // Verify the password using bcrypt
        const isMatch = await bcrypt.compare(pass, storedHashedPassword);


        if (isMatch) {
            req.session.user_id = user.id; // Store user ID in session

            const ip_add = req.ip || req.connection.remoteAddress;

            // Create JWT token
            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRES
            });

            // Write token to cookie
            writeCookie(req, res, "userRegistered", token);
            writeCookie(req,res, "editor", user.id)

            // Redirect user to dashboard
            return res.json({status:"success", message:"Login Successful", token:token});
        } else {
            return res.status(401).json({ status: "error", message: "Invalid Credentials" });
        }

    } catch (err) {
        console.error("Database or Bcrypt error:", err);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
};

module.exports = EditorLogin;
