const db = require("../../routes/db.config")
const hashPassword = require("../utils/hashPassword")

const reviewerSignup = async (req,res) =>{
    try{
        
        const { prefix,
            firstname,
            lastname,
            othername,
            orcid,
            discipline,
            email,
            affiliations,
            affiliations_country,
            affiliations_city,
            asfi_membership_id,
            password,} = req.body 

    db.query("SELECT * FROM authors_account WHERE email = ?", [email], async(err, data) =>{
        if(err){
            return res.json({error})
        }
        if(data[0] && (data[0].is_reviewer === 'yes' || data[0].reviewer_invite_status === "accepted")){
           return res.json({error:"Account already exists, Proceedlogin"})
        }else{
            
            const hashedPassword = await hashPassword(password)
            db.query("INSERT INTO authors_account SET ?", [{prefix, firstname, lastname, affiliations, affiliation_city:affiliations_city, email:email,affiliation_country:affiliations_country, othername, discipline, orcid_id:orcid, account_status:'verified', asfi_membership_id,password:hashedPassword, is_available_for_review:'yes', is_reviewer:'yes', reviewer_invite_status:'accepted'}], async (err, signup) =>{
                if(err){
                    console.log(err)
                    return res.json({error:err})
                }
                else{
                    return res.json({success:"Account created succesfully"})
                }
            })
        }
    })

    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }
}

module.exports = reviewerSignup