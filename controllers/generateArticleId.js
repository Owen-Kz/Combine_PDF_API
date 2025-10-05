// generateArticleId.js - Counter table approach
const dbPromise = require("../routes/dbPromise.config");

async function retryOperation(operation, maxRetries = 3, delay = 100) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (error.code !== 'ER_LOCK_DEADLOCK' && error.code !== 'ER_DUP_ENTRY' && error.errno !== 1213) {
                throw error;
            }

            console.log(`Database error (${error.code}), retry attempt ${attempt}/${maxRetries}`);

            if (attempt < maxRetries) {
                const backoffDelay = delay * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
        }
    }

    throw lastError;
}

const generateArticleId = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            throw new Error("Session is Not Valid, please login again");
        }

        return await retryOperation(async () => {
            let connection;
            try {
                connection = await dbPromise.getConnection();
                await connection.beginTransaction();

                // Always use UTC to avoid timezone issues
                const year = new Date().getUTCFullYear();

                // Atomically get and increment the counter
                const [updateResult] = await connection.query(`
                    UPDATE submission_counter 
                    SET last_number = last_number + 1 
                    WHERE year = ?
                `, [year]);

                if (updateResult.affectedRows === 0) {
                    // First submission for this year
                    await connection.query(`
                        INSERT INTO submission_counter (year, last_number) 
                        VALUES (?, 1)
                    `, [year]);
                }

                // Get the new number
                const [counterResult] = await connection.query(`
                    SELECT last_number FROM submission_counter WHERE year = ?
                `, [year]);

                const nextNumber = counterResult[0].last_number;
                const submissionsCount = String(nextNumber).padStart(6, '0');
                const articleID = `ASFIRJ-${year}-${submissionsCount}`;

                // Create the submission record
                await connection.query(
                    "INSERT INTO submissions (revision_id, article_id, title, status, corresponding_authors_email, date_submitted) VALUES (?, ?, ?, ?, ?, NOW())",
                    [articleID, articleID, "Draft Submission", "draft", req.user.email]
                );

                await connection.commit();
                console.log("Generated new article ID:", articleID);
                return articleID;

            } catch (error) {
                if (connection) await connection.rollback();
                throw error;
            } finally {
                if (connection) connection.release();
            }
        });

    } catch (error) {
        console.error("System error generating article ID:", error);
        throw error;
    }
};

module.exports = generateArticleId;