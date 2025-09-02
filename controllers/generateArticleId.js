// Updated generateArticleId.js
const dbPromise = require("../routes/dbPromise.config");

const generateArticleId = async (req, res) => {
    let connection;
    try {
        if (!req.user || !req.user.id) {
            console.log('Invalid Session');
            throw new Error("Session is Not Valid, please login again");
        }

        connection = await dbPromise.getConnection();
        await connection.beginTransaction();

        // Lock the table or use SELECT FOR UPDATE to prevent race conditions
        const [rows] = await connection.query(
            "SELECT id FROM submissions ORDER BY id DESC LIMIT 1 FOR UPDATE"
        );

        let submissionsCount;
        if (rows.length > 0) {
            const countSub = Number(rows[0].id) + 1;
            submissionsCount = String(countSub).padStart(6, '0');
        } else {
            submissionsCount = "000001";
        }

        const articleID = `ASFIRJ-${new Date().getFullYear()}-${submissionsCount}`;
        
        // Create a placeholder record immediately to claim the ID
        await connection.query(
            "INSERT INTO submissions (revision_id, article_id, title, status, corresponding_authors_email, date_submitted) VALUES (?, ?, ?, ?, NOW())",
            [articleID, articleID, "Draft Submission", "draft", req.user.email]
        );

        await connection.commit();
        console.log("Generated new article ID:", articleID);
        return articleID;

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error("System error generating article ID:", error);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = generateArticleId;