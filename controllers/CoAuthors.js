const crypto = require('crypto');

const db = require("../routes/db.config")
const CreatePassword = require("./utils/createPassword");
const sendCoAuthorEmail = require('./utils/sendCOAuthorEmail');

const CoAuthors = async (req,res,articleId) =>{
    try{
        const currentUser = req.user.email 
        db.query("SELECT * FROM submission_authors WHERE submission_id = ? AND authors_email != ?", [articleId, currentUser], async(err, author) =>{
            if(err){
                console.log(err)
                return {error:err}
            }else if(author[0]){
                author.forEach(person => {
                    console.log(person.authors_email)
                    let fullName  = person.authors_fullname
                    let nameParts = fullName.split(" "); // Split the name by spaces
                      let prefix = nameParts[0]; // First part is the prefix
                    let firstName = nameParts[1] || ""; // Second part is the first name
                    let lastName = nameParts[nameParts.length - 1] || ""; // Last part is the last name
                    let otherNames = nameParts.slice(2, -1).join(" ") || "";
                    // CHeck if the person has an account 
                    db.query("SELECT * FROM authors_account WHERE email = ?", [person.authors_email], async(err, account) =>{
                        if(err){
                            console.log(err)
                        }else if(account[0]){
                            console.log("account exists")
                        }else{

                            const password = crypto.randomBytes(8).toString('hex');
                            const hashedPasswod =CreatePassword(password)
                            
                            db.query("INSERT INTO authors_account SET ?",[{prefix:prefix, email:person.authors_email, firstname:firstName, lastname:lastName, othername:otherNames, orcid_id:person.orcid_id, affiliations:person.affiliations, affiliation_country:person.affiliation_country, affiliation_city:person.affiliation_city, asfi_membership_id:person.asfi_membership_id, password:hashedPasswod}], async(err, newAccount) =>{
                                if(err){
                                    console.log(err) 
                                }else if(newAccount){
                                 sendCoAuthorEmail(person.authors_email, password)
                                }
                            })
                        }
                    })
                });
            }
            
        })
    }catch(error){
        console.log(error)
        return {error:error.message}
    }
}

module.exports = CoAuthors