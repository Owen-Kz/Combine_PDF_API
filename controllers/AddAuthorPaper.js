const db = require("../routes/db.config");
const multer = require("multer");
const dbPromise = require("../routes/dbPromise.config");
const upload = multer();
const AddAuthorToPaper = async (req, res) => {
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
                loggedIn_authors_prefix,
                loggedIn_authors_first_name,
                loggedIn_authors_last_name,
                loggedIn_authors_other_name,
                loggedIn_authors_ORCID,
                loggedIn_affiliation,
                loggedIn_affiliation_country,
                loggedIn_affiliation_city,
                loggedIn_membership_id,
                authors_prefix,
                authors_first_name,
                authors_last_name,
                authors_other_name,
                authors_orcid,
                affiliation,
                affiliation_country,
                affiliation_city,
                membership_id,
                corresponding_author,
                email
            } = req.body;

            // Get submission ID from session
            const mainSubmissionId = req.session.articleId;
            if (!mainSubmissionId) {
                return res.status(400).json({ 
                    status: "error", 
                    error: "No active manuscript session" 
                });
            }

            // Normalize emails to array
            const emails = Array.isArray(email) ? email : [email].filter(Boolean);
            const hasAuthors = emails.length > 0 || corresponding_author;
            
            if (!hasAuthors) {
                return res.status(400).json({ 
                    status: "error", 
                    error: "At least one author is required" 
                });
            }

            const insertedAuthors = [];
            const skippedAuthors = [];

            // Process logged-in author (corresponding author)
            if (corresponding_author) {
                try {
                    const loggedInFullname = [
                        loggedIn_authors_prefix,
                        loggedIn_authors_first_name,
                        loggedIn_authors_last_name,
                        loggedIn_authors_other_name
                    ].filter(Boolean).join(' ');

                    // Check if author exists
                    const [existingAuthor] = await dbPromise.query(
                        "SELECT 1 FROM submission_authors WHERE authors_email = ? AND submission_id = ?",
                        [corresponding_author, mainSubmissionId]
                    );

                    if (!existingAuthor.length) {
                        await dbPromise.query(
                            `INSERT INTO submission_authors SET ?`,
                            {
                                submission_id: mainSubmissionId,
                                authors_fullname: loggedInFullname,
                                authors_email: corresponding_author,
                                orcid_id: loggedIn_authors_ORCID,
                                affiliations: loggedIn_affiliation,
                                affiliation_country: loggedIn_affiliation_country,
                                affiliation_city: loggedIn_affiliation_city,
                                asfi_membership_id: loggedIn_membership_id,
                                // is_corresponding_author: 1
                            }
                        );
                        insertedAuthors.push(corresponding_author);
                    } else {
                        skippedAuthors.push({
                            email: corresponding_author,
                            reason: "already_exists"
                        });
                    }
                } catch (error) {
                    console.error("Error processing corresponding author:", error);
                    skippedAuthors.push({
                        email: corresponding_author,
                        reason: "processing_error"
                    });
                }
            }

            // Process additional authors
            for (let i = 0; i < emails.length; i++) {
                const authorEmail = emails[i]?.trim();
                if (!authorEmail) continue;

                try {
                    const authorFullname = [
                        authors_prefix[i],
                        authors_first_name[i],
                        authors_last_name[i],
                        authors_other_name[i]
                    ].filter(Boolean).join(' ');

                    // Check if author exists
                    const [existingAuthor] = await dbPromise.query(
                        "SELECT 1 FROM submission_authors WHERE authors_email = ? AND submission_id = ?",
                        [authorEmail, mainSubmissionId]
                    );

                    if (!existingAuthor.length) {
                        await dbPromise.query(
                            `INSERT INTO submission_authors SET ?`,
                            {
                                submission_id: mainSubmissionId,
                                authors_fullname: authorFullname,
                                authors_email: authorEmail,
                                orcid_id: authors_orcid[i],
                                affiliations: affiliation[i],
                                affiliation_country: affiliation_country[i],
                                affiliation_city: affiliation_city[i],
                                asfi_membership_id: membership_id[i],
                                // is_corresponding_author: 0
                            }
                        );
                        insertedAuthors.push(authorEmail);
                    } else {
                        skippedAuthors.push({
                            email: authorEmail,
                            reason: "already_exists"
                        });
                    }
                } catch (error) {
                    console.error(`Error processing author ${authorEmail}:`, error);
                    skippedAuthors.push({
                        email: authorEmail,
                        reason: "processing_error"
                    });
                }
            }

            return res.json({ 
                status: "success",
                success: "Authors processed successfully",
                inserted: insertedAuthors,
                skipped: skippedAuthors,
                corresponding_author: corresponding_author || null
            });

        } catch (error) {
            console.error("System error processing authors:", error);
            return res.status(500).json({ 
                status: "error", 
                error: "Failed to process authors",
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });
};

module.exports = AddAuthorToPaper;