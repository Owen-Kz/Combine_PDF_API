const dbPromise = require("../../routes/dbPromise.config")
const bcrypt = require("bcryptjs")

const updateAccountData = async (req,res) =>{
    try{
        const userId = req.query.e 
        const {affiliation_city, affiliation_country, affiliation, other_name, first_name, last_name, prefix, discipline, email, orcid, asfi_membership_id, is_available_for_review, password, confirm_password} = req.body 

        // Check if the user exists 
        if(!email || !first_name || !last_name){
            return res.json({error:"Name and Email are required"})
        }

        // Validate passwords if provided
        if (password || confirm_password) {
            // Check if both password fields are filled
            if (!password || !confirm_password) {
                return res.json({error:"Both password fields are required if changing password"});
            }
            
            // Check if passwords match
            if (password !== confirm_password) {
                return res.json({error:"Passwords do not match"});
            }
            
            // Check password strength (minimum 8 characters)
            if (password.length < 8) {
                return res.json({error:"Password must be at least 8 characters long"});
            }
        }

        if(!req.query.e){
            return res.json({error:"Invalid parameters provided"})
        }
        
        const userExists = await dbPromise.query("SELECT * FROM authors_account WHERE md5(email) = ?", [userId])
        if(userExists[0].length > 0){
            // Prepare update data
            const updateData = {
                discipline, 
                affiliation_city, 
                affiliation_country, 
                affiliations: affiliation, 
                orcid_id: orcid, 
                asfi_membership_id, 
                is_available_for_review, 
                othername: other_name, 
                firstname: first_name, 
                lastname: last_name, 
                prefix, 
                account_status: "verified"
            };
            
            // Only hash and update password if provided
            if (password && password.length > 0) {
                const saltRounds = 10;
                const hash = await bcrypt.hash(password, saltRounds);
                updateData.password = hash;
            }
            
            await dbPromise.query(
                "UPDATE authors_account SET ? WHERE md5(email) = ? AND email = ?", 
                [updateData, userId, email]
            );
            
            return res.json({success:"Account Updated successfully, please proceed to login"})
        } else {
            return res.json({error:"This user does not exist"})
        }
    } catch(error) {
        console.log(error)
        return res.json({error: error?.message || "An error occurred"})
    }
}

module.exports = updateAccountData