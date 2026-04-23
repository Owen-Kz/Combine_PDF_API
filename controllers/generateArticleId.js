// generateArticleId.js - Updated for Submission Manager
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

                // Check if this is a correction or revision
                const isCorrection = req.query.correct === 'true' && req.query.a;
                const isRevision = req.query.revise === 'true' && req.query.a;
                const originalArticleId = req.query.a;

                if (isCorrection || isRevision) {
                    console.log(`Processing ${isCorrection ? 'correction' : 'revision'} for article:`, originalArticleId);
                    
                    // Get the original submission to check correction/revision counts
                    const [originalSubmission] = await connection.query(`
                        SELECT article_id, corrections_count, revisions_count, corresponding_authors_email 
                        FROM submissions 
                        WHERE revision_id = ? OR article_id = ?
                        ORDER BY process_start_date DESC 
                        LIMIT 1
                    `, [originalArticleId, originalArticleId]);

                    if (!originalSubmission || originalSubmission.length === 0) {
                        throw new Error(`Original submission ${originalArticleId} not found`);
                    }

                    const original = originalSubmission[0];
                    
                    // Verify the user has access to the original submission
                    if (original.corresponding_authors_email !== req.user.email) {
                        throw new Error("You do not have permission to modify this submission");
                    }

                    let newArticleId;
                    let suffix;

                    if (isCorrection) {
                        // Generate correction ID
                        const correctionCount = (original.corrections_count || 0) + 1;
                        suffix = `.Cr${correctionCount}`;
                        newArticleId = original.article_id + suffix;
                        
                        // Update corrections count in the original article
                        await connection.query(`
                            UPDATE submissions 
                            SET corrections_count = ? 
                            WHERE article_id = ?
                        `, [correctionCount, original.article_id]);
                        
                        console.log(`Generated correction ID: ${newArticleId} (correction #${correctionCount})`);

                    } else if (isRevision) {
                        // Generate revision ID
                        const revisionCount = (original.revisions_count || 0) + 1;
                        suffix = `.R${revisionCount}`;
                        newArticleId = original.article_id + suffix;
                        
                        // Update revisions count in the original article
                        await connection.query(`
                            UPDATE submissions 
                            SET revisions_count = ? 
                            WHERE article_id = ?
                        `, [revisionCount, original.article_id]);
                        
                        console.log(`Generated revision ID: ${newArticleId} (revision #${revisionCount})`);
                    }

                    // Create the new submission record for correction/revision
                    await connection.query(
                        `INSERT INTO submissions 
                         (revision_id, article_id, corresponding_authors_email, status, 
                          previous_manuscript_id, date_submitted, last_updated, process_start_date) 
                         VALUES (?, ?, ?, 'draft', ?, NOW(), NOW(), NOW())`,
                        [newArticleId, original.article_id, req.user.email, originalArticleId]
                    );

                    await connection.commit();
                    console.log(`Created ${isCorrection ? 'correction' : 'revision'} submission:`, newArticleId);
                    return newArticleId;
                }

                // Regular new submission - use the counter system
                // Always use UTC to avoid timezone issues
                const year = new Date().getUTCFullYear();

                // Check if counter table exists, create if not
                try {
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
                } catch (counterError) {
                    // Counter table might not exist, create it
                    if (counterError.code === 'ER_NO_SUCH_TABLE') {
                        await connection.query(`
                            CREATE TABLE submission_counter (
                                year INT PRIMARY KEY,
                                last_number INT DEFAULT 0,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )
                        `);
                        
                        // Now insert the first record
                        await connection.query(`
                            INSERT INTO submission_counter (year, last_number) 
                            VALUES (?, 1)
                        `, [year]);
                    } else {
                        throw counterError;
                    }
                }

                // Get the new number
                const [counterResult] = await connection.query(`
                    SELECT last_number FROM submission_counter WHERE year = ?
                `, [year]);

                const nextNumber = counterResult[0].last_number;
                const submissionsCount = String(nextNumber).padStart(6, '0');
                const articleID = `ASFIRJ-${year}-${submissionsCount}`;

                // Create the submission record with minimal data
                await connection.query(
                    `INSERT INTO submissions 
                     (revision_id, article_id, corresponding_authors_email, status, date_submitted, last_updated, process_start_date) 
                     VALUES (?, ?, ?, 'draft', NOW(), NOW(), NOW())`,
                    [articleID, articleID, req.user.email]
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
        
        // Fallback: Generate ID without database counter
        if (error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_ACCESS_DENIED_ERROR' || 
            error.message.includes('not found') || error.message.includes('permission')) {
            console.log("Using fallback ID generation");
            
            let fallbackId;
            const year = new Date().getUTCFullYear();
            
            // Check if this is a correction or revision for fallback
            const isCorrection = req.query.correct === 'true' && req.query.a;
            const isRevision = req.query.revise === 'true' && req.query.a;
            const originalArticleId = req.query.a;

            if ((isCorrection || isRevision) && originalArticleId) {
                // Fallback for corrections/revisions
                const timestamp = Date.now().toString(36).substr(-6);
                const suffix = isCorrection ? '.CrF' : '.RF';
                fallbackId = `${originalArticleId}${suffix}${timestamp}`.substr(0, 100); // Ensure length limit
                console.log(`Generated fallback ${isCorrection ? 'correction' : 'revision'} ID:`, fallbackId);
            } else {
                // Fallback for new submissions
                const timestamp = Date.now().toString(36);
                const random = Math.random().toString(36).substr(2, 9);
                fallbackId = `ASFIRJ-${year}-F${timestamp}${random}`.substr(0, 50);
                console.log("Generated fallback article ID:", fallbackId);
            }
            
            try {
                // Still try to create the submission record
                const articleIdForDb = (isCorrection || isRevision) ? originalArticleId : fallbackId;
                const previousId = (isCorrection || isRevision) ? originalArticleId : null;
                
                await dbPromise.execute(
                    `INSERT INTO submissions 
                     (revision_id, article_id, corresponding_authors_email, status, previous_manuscript_id, date_submitted, last_updated, process_start_date) 
                     VALUES (?, ?, ?, 'draft', ?, NOW(), NOW(), NOW())`,
                    [fallbackId, articleIdForDb, req.user.email, previousId]
                );
                
                return fallbackId;
            } catch (fallbackError) {
                console.error("Fallback ID creation failed:", fallbackError);
                throw new Error("Unable to create submission. Please try again.");
            }
        }
        
        throw error;
    }
};

// Export for use in SubmissionManager
module.exports = generateArticleId;
module.exports.retryOperation = retryOperation;