// backend/controllers/author/coAuthors.js
const crypto = require('crypto');
const db = require('../routes/db.config');
const CreatePassword = require("./utils/createPassword");
const sendCoAuthorEmail = require('./utils/sendCOAuthorEmail');
const CoAuthors = async (req, res, articleId) => {
    try {
        const currentUser = req.user.email;
        
        return new Promise((resolve, reject) => {
            db.query(
                "SELECT * FROM submission_authors WHERE submission_id = ? AND authors_email != ?", 
                [articleId, currentUser], 
                async (err, authors) => {
                    if (err) {
                        console.log(err);
                        reject({ error: err });
                        return;
                    }

                    if (authors && authors.length > 0) {
                        const emailPromises = authors.map(person => {
                            return new Promise((resolveAuthor, rejectAuthor) => {
                                console.log(person.authors_email);
                                let fullName = person.authors_fullname;
                                let nameParts = fullName.split(" ");
                                let prefix = nameParts[0];
                                let firstName = nameParts[1] || "";
                                let lastName = nameParts[nameParts.length - 1] || "";
                                let otherNames = nameParts.slice(2, -1).join(" ") || "";

                                // Check if the person has an account
                                db.query(
                                    "SELECT * FROM authors_account WHERE email = ?", 
                                    [person.authors_email], 
                                    async (err, account) => {
                                        if (err) {
                                            console.log(err);
                                            rejectAuthor(err);
                                        } else if (account && account.length > 0) {
                                            console.log("Account exists for:", person.authors_email);
                                            resolveAuthor({ exists: true, email: person.authors_email });
                                        } else {
                                            try {
                                                const password = crypto.randomBytes(8).toString('hex');
                                                const hashedPassword = await CreatePassword(password);

                                                db.query(
                                                    "INSERT INTO authors_account SET ?",
                                                    [{
                                                        prefix: prefix,
                                                        email: person.authors_email,
                                                        firstname: firstName,
                                                        lastname: lastName,
                                                        othername: otherNames,
                                                        orcid_id: person.orcid_id,
                                                        affiliations: person.affiliations,
                                                        affiliation_country: person.affiliation_country,
                                                        affiliation_city: person.affiliation_city,
                                                        asfi_membership_id: person.asfi_membership_id,
                                                        password: hashedPassword,
                                                        account_status: 'unverified'
                                                    }],
                                                    async (err, newAccount) => {
                                                        if (err) {
                                                            console.log(err);
                                                            rejectAuthor(err);
                                                        } else if (newAccount) {
                                                            await sendCoAuthorEmail(person.authors_email, password, articleId);
                                                            resolveAuthor({ created: true, email: person.authors_email });
                                                        }
                                                    }
                                                );
                                            } catch (createError) {
                                                console.error('Error creating author account:', createError);
                                                rejectAuthor(createError);
                                            }
                                        }
                                    }
                                );
                            });
                        });

                        const results = await Promise.allSettled(emailPromises);
                        console.log('Co-author processing results:', results);
                        resolve({ success: true, results });
                    } else {
                        resolve({ success: true, message: "No co-authors found" });
                    }
                }
            );
        });

    } catch (error) {
        console.log(error);
        return { error: error.message };
    }
};

module.exports = CoAuthors;