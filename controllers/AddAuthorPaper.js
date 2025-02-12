const db = require("../routes/db.config");
const multer = require("multer");
const upload = multer();

const AddAuthorToPaper = async (req, res) => {
  
    upload.none()(req, res, async (err) => {
        if (err) {
            return res.json({ status: "error", error: "Multer error" });
        }
        try {
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

            const mainSubmissionId = req.cookies._sessionID;
            if ((!email || email.length === 0) && !corresponding_author) {
                return res.json({ status: "error", error: "No authors provided" });
            }

            let insertPromises = [];

            // Function to check if an author exists
            const checkAuthorExists = (authorEmail) => {
                return new Promise((resolve, reject) => {
                    db.query(
                        "SELECT * FROM `submission_authors` WHERE `authors_email` = ? AND `submission_id` = ?",
                        [authorEmail, mainSubmissionId],
                        (err, data) => {
                            if (err) return reject(err);
                            resolve(data.length > 0);
                        }
                    );
                });
            };

            // Function to insert an author
            const insertAuthor = (fullname, authorEmail, orcid, aff, country, city, membershipId) => {
                return new Promise((resolve, reject) => {
                    db.query(
                        `INSERT INTO submission_authors 
                        (submission_id, authors_fullname, authors_email, orcid_id, affiliations, affiliation_country, affiliation_city, asfi_membership_id) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [mainSubmissionId, fullname, authorEmail, orcid, aff, country, city, membershipId],
                        (err, result) => {
                            if (err) return reject(err);
                            resolve(result);
                        }
                    );
                });
            };

            // Process logged-in author first
            if (loggedIn_authors_first_name && loggedIn_authors_last_name) {
                const loggedInFullname = `${loggedIn_authors_prefix} ${loggedIn_authors_first_name} ${loggedIn_authors_last_name} ${loggedIn_authors_other_name}`;
                const loggedInEmail = corresponding_author; // Assuming this comes from the session or cookies

                if (loggedInEmail) {
                    const loggedInExists = await checkAuthorExists(loggedInEmail);
                    if (!loggedInExists) {
                        insertPromises.push(
                            insertAuthor(
                                loggedInFullname,
                                loggedInEmail,
                                loggedIn_authors_ORCID,
                                loggedIn_affiliation,
                                loggedIn_affiliation_country,
                                loggedIn_affiliation_city,
                                loggedIn_membership_id
                            )
                        );
                    }
                }
            }

            // Process additional authors
            if(email && email.length >0){
            for (let i = 0; i < email.length; i++) {
                let authorEmail = email[i];

                if (!authorEmail) continue; // Skip empty emails

                let authorsFullname = `${authors_prefix[i]} ${authors_first_name[i]} ${authors_last_name[i]} ${authors_other_name[i]}`;

                const authorExists = await checkAuthorExists(authorEmail);

                if (!authorExists) {
                    insertPromises.push(
                        insertAuthor(
                            authorsFullname,
                            authorEmail,
                            authors_orcid[i],
                            affiliation[i],
                            affiliation_country[i],
                            affiliation_city[i],
                            membership_id[i]
                        )
                    );
                }
            }
        }

            // Execute all insert queries
            await Promise.all(insertPromises);

            res.json({ success: "Authors Created Successfully" });
        } catch (error) {
            console.error("Error Processing Authors:", error.message);
            return res.json({ status: "error", error: `Error Processing Author: ${error.message}` });
        }
    });
};

module.exports = AddAuthorToPaper;
