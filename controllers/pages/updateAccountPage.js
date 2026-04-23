const dbPromise = require("../../routes/dbPromise.config")

const updateAccount = async (req,res) =>{
    try{
        // check if the user exists 
        const queryParam = req.query.e
        const userExists = await dbPromise.query("SELECT * FROM authors_account WHERE md5(email) = ? ", [queryParam])
        if(userExists[0].length >0){
            if(userExists[0][0].account_status === 'verified'){
              return  res.render("success", {status:"success", tag:"Account Verified", message:"Account already verified, please login"})
            }else{
                const user = userExists[0][0]
                const email = user.email
                const prefix = user.prefix
                const firstname = user.firstname 
                const lastname = user.lastname 
                const othername = user.othername 
                const orcidId = user.orcid_id 
                const discipline = user.discipline 
                const affiliations = user.affiliations 
                const affiliationCountry = user.affiliation_country 
                const affiliationCity = user.affiliation_city
                const asfi_membership_id = user.asfi_membership_id
        

       return res.render("updateAccount", {email, prefix, firstname, lastname, othername, orcidId, discipline, affiliations, affiliationCountry, affiliationCity, asfi_membership_id, userId:queryParam})

            }
        }else{
              return  res.render("success", {status:"error", tag:"Not Found", message:"This account does not exist"})

        }
    }catch(error){
        return res.json({error:"Something went wrong", message:error?.message})
    }

}


module.exports = updateAccount