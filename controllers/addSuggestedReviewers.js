const db = require("../routes/db.config");
const multer = require("multer");
const upload = multer();

const AddReviewerToPaper = async (req, res) => {
  
    upload.none()(req, res, async (err) => {
        if (err) {
            return res.json({ status: "error", error: "Multer error" });
        }
        try {
            const {
      
     
                suggested_reviewer_fullname,
                suggested_reviewer_affiliation,
                suggested_reviewer_country,
                suggested_reviewer_city,
                suggested_reviewer_email
            } = req.body;

            const mainSubmissionId = req.cookies._sessionID;
            const email = suggested_reviewer_email
            if (!email || email.length === 0) {
                return res.json({ status: "error", error: "No reviewers provided" });
            }

            let insertPromises = [];

            // Function to check if an reviewer exists
            const checkRevieweExists = (reviewerEmail) => {
                return new Promise((resolve, reject) => {
                    db.query(
                        "SELECT * FROM `suggested_reviewers` WHERE `email` = ? AND `article_id` = ?",
                        [reviewerEmail, mainSubmissionId],
                        (err, data) => {
                            if (err) return reject(err);
                            resolve(data.length > 0);
                        }
                    );
                });
            };

            const checkReviewerIsAuthor = (reviewerEmail) => {
                return new Promise((resolve, reject) => {
                    db.query(
                        "SELECT * FROM `submission_authors` WHERE `authors_email` = ? AND `submission_id` = ?",
                        [reviewerEmail, mainSubmissionId],
                        (err, data) => {
                            if (err) return reject(err);
                            resolve(data.length > 0);
                        }
                    );
                });
            };
            // Function to insert an reviewer
            const insertReviewer = (fullname, reviewerEmail,aff, country, city) => {
                return new Promise((resolve, reject) => {
                    db.query(
                        `INSERT INTO suggested_reviewers SET ?`,
                        [{article_id:mainSubmissionId, fullname:fullname, email:reviewerEmail, affiliation:aff, affiliation_country:country, affiliation_city:city}],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                });
            };

    

            // Process additional reviewers

            if(email && email.length >0){
            for (let i = 0; i < email.length; i++) {
                let reviewerEmail = email[i];

                if (!reviewerEmail) continue; // Skip empty emails

                let reviewersFullname = `${suggested_reviewer_fullname[i]}`;

                const reviewerExists = await checkRevieweExists(reviewerEmail);
                const isAuthor = await checkReviewerIsAuthor(reviewerEmail)
                if (!reviewerExists && !isAuthor) {
                    insertPromises.push(
                        insertReviewer(
                            reviewersFullname,
                            reviewerEmail,
                            suggested_reviewer_affiliation[i],
                            suggested_reviewer_country[i],
                            suggested_reviewer_city[i],
                        )
                    );
                }
            }
        }

            // Execute all insert queries
            await Promise.all(insertPromises);

            res.json({ success: "reviewers Created Successfully" });
        } catch (error) {
            console.error("Error Processing reviewers:", error);
            return res.json({ status: "error", error: `Error Processing reviewer: ${error.message}` });
        }
    });
};

module.exports = AddReviewerToPaper;
