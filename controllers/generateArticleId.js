// generateArticleId.js - Updated for Submission Manager
const dbPromise = require("../routes/dbPromise.config");
const {
    stripDerivedSuffix,
} = require("./utils/submissionIdUtils");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Statuses that mean a draft is still editable; rows in any other state are
// finalised and must never be reused as the target of a new revision/correction.
const NON_REUSABLE_STATUSES = [
    'submitted', 'revision_submitted', 'correction_submitted',
    'submitted_for_review', 'accepted', 'rejected'
];

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
                console.log(req.query)

                if (isCorrection || isRevision) {
                    console.log(`Processing ${isCorrection ? 'correction' : 'revision'} for article:`, originalArticleId);

                    // Get the original submission to check correction/revision counts.
                    // A revision/correction may be launched from the base article or from a
                    // previous revision row, so match either identifier.
                    const [originalSubmission] = await connection.query(`
                        SELECT article_id, revision_id, corrections_count, revisions_count, corresponding_authors_email,
                               article_type, discipline, title, manuscript_file, document_file,
                               tracked_manuscript_file, cover_letter_file, tables, figures,
                               graphic_abstract, supplementary_material, abstract,
                               is_women_in_contemporary_science, is_belispoint_academic, is_kidnapping_for_ransom
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

                    const type = isCorrection ? 'Cr' : 'R';
                    const baseId = original.article_id;
                    const copyFromId = original.revision_id || originalArticleId;
                    // Idempotency: any in-progress draft for this base+type is reused instead
                    // of creating a duplicate row. Keyed off the base id and a draft status,
                    // never off the title, so retries/refreshes stay safe.
                    const [existingDrafts] = await connection.query(`
                        SELECT revision_id, revisions_count, corrections_count
                        FROM submissions
                        WHERE revision_id REGEXP ?
                          AND (article_id = ? OR previous_manuscript_id = ?)
                          AND status NOT IN (?)
                        ORDER BY process_start_date DESC
                        LIMIT 1
                    `, [
                        `^${escapeRegex(baseId)}[._](${type})[a-zA-Z0-9]*$`,
                        baseId,
                        originalArticleId,
                        NON_REUSABLE_STATUSES
                    ]);

                    const countColumn = isCorrection ? 'corrections_count' : 'revisions_count';
                    let newArticleId;

                    if (existingDrafts.length > 0) {
                        newArticleId = existingDrafts[0].revision_id;
                        await connection.commit();
                        console.log(`Reused existing ${isCorrection ? 'correction' : 'revision'} draft:`, newArticleId);
                        return newArticleId;
                    }

                    // Next sequential number is derived from the counter on the base row.
                    const nextCount = (original[countColumn] || 0) + 1;
                    newArticleId = `${baseId}_${type}${nextCount}`;

                    // Stamp the counter back onto the base row while creating the new row.
                    await connection.query(
                        `UPDATE submissions SET ?? = ? WHERE article_id = ? AND revision_id = ?`,
                        [countColumn, nextCount, baseId, baseId]
                    );

                    await connection.query(
                        `INSERT INTO submissions (
                            article_type, discipline, title, manuscript_file, document_file,
                            tracked_manuscript_file, cover_letter_file, tables, figures,
                            graphic_abstract, supplementary_material, abstract,
                            corresponding_authors_email,
                            article_id, revision_id, revisions_count, corrections_count,
                            previous_manuscript_id, status, last_updated, process_start_date,
                            is_women_in_contemporary_science, is_belispoint_academic, is_kidnapping_for_ransom
                         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NOW(), NOW(), ?, ?, ?)`,
                        [
                            original.article_type, original.discipline, original.title, original.manuscript_file, original.document_file,
                            original.tracked_manuscript_file, original.cover_letter_file, original.tables, original.figures,
                            original.graphic_abstract, original.supplementary_material, original.abstract,
                            req.user.email,
                            baseId, newArticleId,
                            isCorrection ? (original.revisions_count || 0) : nextCount,
                            isCorrection ? nextCount : (original.corrections_count || 0),
                            originalArticleId,
                            original.is_women_in_contemporary_science || 'no',
                            original.is_belispoint_academic || 'no',
                            original.is_kidnapping_for_ransom || 'no'
                        ]
                    );

                    // Carry the previous version's related data into the new row so the
                    // wizard pre-fills and the author only has to make their edits.
                    const [keywords] = await connection.query(
                        `SELECT keyword FROM submission_keywords WHERE article_id = ?`,
                        [copyFromId]
                    );
                    if (keywords.length > 0) {
                        await connection.query(
                            `INSERT INTO submission_keywords (article_id, keyword) VALUES ?`,
                            [keywords.map(k => [newArticleId, k.keyword])]
                        );
                    }

                    const [authors] = await connection.query(
                        `SELECT authors_fullname, authors_email, orcid_id, asfi_membership_id,
                                affiliations, affiliation_country, affiliation_city
                         FROM submission_authors WHERE submission_id = ?`,
                        [copyFromId]
                    );
                    if (authors.length > 0) {
                        await connection.query(
                            `INSERT INTO submission_authors
                             (submission_id, authors_fullname, authors_email, orcid_id, asfi_membership_id,
                              affiliations, affiliation_country, affiliation_city) VALUES ?`,
                            [authors.map(a => [
                                newArticleId, a.authors_fullname, a.authors_email, a.orcid_id,
                                a.asfi_membership_id, a.affiliations, a.affiliation_country, a.affiliation_city
                            ])]
                        );
                    }

                    const [reviewers] = await connection.query(
                        `SELECT fullname, email, affiliation, affiliation_country, affiliation_city
                         FROM suggested_reviewers WHERE article_id = ?`,
                        [copyFromId]
                    );
                    if (reviewers.length > 0) {
                        await connection.query(
                            `INSERT INTO suggested_reviewers
                             (article_id, fullname, email, affiliation, affiliation_country, affiliation_city) VALUES ?`,
                            [reviewers.map(r => [
                                newArticleId, r.fullname, r.email, r.affiliation,
                                r.affiliation_country, r.affiliation_city
                            ])]
                        );
                    }

                    await connection.commit();
                    console.log(`Created ${isCorrection ? 'correction' : 'revision'} submission: ${newArticleId} (${isCorrection ? 'correction' : 'revision'} #${nextCount})`);
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
                const base = stripDerivedSuffix(originalArticleId) || originalArticleId;
                const timestamp = Date.now().toString(36).substr(-6);
                const suffix = isCorrection ? '_CrF' : '_RF';
                fallbackId = `${base}${suffix}${timestamp}`.substr(0, 100); // Ensure length limit
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