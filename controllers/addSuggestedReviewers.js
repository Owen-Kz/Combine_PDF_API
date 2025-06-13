const db = require("../routes/db.config");
const multer = require("multer");
const dbPromise = require("../routes/dbPromise.config");
const upload = multer();


const AddReviewerToPaper = async (req, res) => {
    upload.none()(req, res, async (err) => {
        if (err) {
            console.error("Multer error:", err);
            return res.status(400).json({ 
                status: "error", 
                error: "Invalid form data format" 
            });
        }

        try {
              if(!req.user || !req.user.id){
            return res.json({error:"Session is Not Valid, please login again"})
        }
            const {
                suggested_reviewer_fullname,
                suggested_reviewer_affiliation,
                suggested_reviewer_country,
                suggested_reviewer_city,
                suggested_reviewer_email
            } = req.body;

            // Get submission ID from session
            const mainSubmissionId = req.session.articleId;
            if (!mainSubmissionId) {
                return res.status(400).json({ 
                    status: "error", 
                    error: "No active manuscript session" 
                });
            }

            // Normalize input to array
            const emails = Array.isArray(suggested_reviewer_email) ? 
                suggested_reviewer_email : 
                [suggested_reviewer_email].filter(Boolean);

            if (emails.length === 0) {
                return res.status(400).json({ 
                    status: "error", 
                    error: "At least one reviewer email is required" 
                });
            }

            // Process reviewers
            const insertedReviewers = [];
            const skippedReviewers = [];

            for (let i = 0; i < emails.length; i++) {
                const reviewerEmail = emails[i].trim();
                if (!reviewerEmail) continue;

                const fullName = suggested_reviewer_fullname[i]?.trim() || '';
                const affiliation = suggested_reviewer_affiliation[i]?.trim() || '';
                const country = suggested_reviewer_country[i]?.trim() || '';
                const city = suggested_reviewer_city[i]?.trim() || '';

                try {
                    // Check if reviewer exists or is an author
                    const [existingReviewer, existingAuthor] = await Promise.all([
                        await dbPromise.query(
                            "SELECT 1 FROM suggested_reviewers WHERE email = ? AND article_id = ?",
                            [reviewerEmail, mainSubmissionId]
                        ).then(([rows]) => rows.length > 0),
                        
                        await dbPromise.query(
                            "SELECT 1 FROM submission_authors WHERE authors_email = ? AND submission_id = ?",
                            [reviewerEmail, mainSubmissionId]
                        ).then(([rows]) => rows.length > 0)
                    ]);

                    if (!existingReviewer && !existingAuthor) {
                        await dbPromise.query(
                            "INSERT INTO suggested_reviewers SET ?",
                            {
                                article_id: mainSubmissionId,
                                fullname: fullName,
                                email: reviewerEmail,
                                affiliation: affiliation,
                                affiliation_country: country,
                                affiliation_city: city
                            }
                        );
                        insertedReviewers.push(reviewerEmail);
                    } else {
                        skippedReviewers.push({
                            email: reviewerEmail,
                            reason: existingReviewer ? "already_suggested" : "is_author"
                        });
                    }
                } catch (dbError) {
                    console.error(`Error processing reviewer ${reviewerEmail}:`, dbError);
                    skippedReviewers.push({
                        email: reviewerEmail,
                        reason: "processing_error"
                    });
                }
            }

            return res.json({ 
                status: "success",
                success: "Reviewers processed successfully",
                inserted: insertedReviewers,
                skipped: skippedReviewers
            });

        } catch (error) {
            console.error("System error processing reviewers:", error);
            return res.status(500).json({ 
                status: "error", 
                error: "Failed to process reviewers",
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });
};

module.exports = AddReviewerToPaper;