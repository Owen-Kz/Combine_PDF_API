const db = require("../../routes/db.config")
const hashPassword = require("../utils/hashPassword")
async function createEditor(email, fullname, password, editoriallevel){
    return new Promise((resolve, reject) =>{
        db.query("SELECT * FROM editors WHERE email = ?",[email], async (err, data) =>{
            if(err){
                console.log(err)
                reject(false)
            }else if(data[0]){
                console.log("account already exists")
                resolve(true)
            }else{
                db.query("INSERT INTO editors SET ?", [{fullname:fullname,email:email, password:password, editorial_level:editoriallevel}], (err, created) =>{
                    if(err){
                        console.log(err)
                        reject(false)
                    }else{
                        console.log("account created")
                        resolve(true)
                    }
                })
            }
        })
    })
  
}
const editorSignUp = async (req,res) =>{
    try{
        const {token, prefix, firstname, lastname, othername, email, password, editorial_level, orcid_id, discipline, affiliations, affiliation_country, affiliation_city, asfi_membership_id} = req.body

        if(!firstname || !lastname || !email || !password || !editorial_level){
            return res.json({error:"Invalid parameters"})
        }else{

            const currentTime = new Date().getTime();
            const today = new Date(currentTime).toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'
          
            // Query to fetch invitation details
           
            db.query("SELECT * FROM invitations WHERE invitation_link =? AND invited_user= ?", [token, email], (err, result) => {
              if (err) {
                console.log(err)
                return res.status(500).json({ status: 'error', message: err.message });
              }
  
              if (result[0]) {
                const row = result[0];
                const invitationStatus = row.invitation_status;
                const invitedUserEmail = row.invited_user;
                const invitationId = row.invitation_link;
                const expiryDate = row.invitation_expiry_date;
          
                // Check if the invitation has expired or not
                if (expiryDate === today || invitationStatus === 'expired') {
                  db.query('UPDATE `invitations` SET `invitation_status` = "expired" WHERE `invitation_link` = ? AND `invited_user` = ?', [invitationId, invitedUserEmail], (err) => {
                    if (err) {
                      return res.status(500).json({ status: 'error', message: 'Failed to update invitation status' });
                    }
                    return res.status(400).json({ status: 'error', message: 'Oops, This invitation link has expired' });
                  });
                  console.log(invitationStatus)
                  return;
                }       
                      db.query("SELECT * FROM authors_account WHERE email =?", [invitedUserEmail], async(err, authorExists)=>{
                        if(err){
                          console.log(err)
                          return res.json({status:"error", message:err})
                        }
                        const fullname = `${prefix} ${firstname} ${othername} ${lastname}`
                        const hashedPassword = await hashPassword(password)
                        if(authorExists[0]){
                            // await createEditor(email, fullname, hashedPassword, editorial_level)
                            const createResponse = await createEditor(email, fullname, hashedPassword, editorial_level)
                            if(createResponse == true){
                                return res.json({success:"Editor account created succesfully"})
                            }else{
                                return res.json({error:"editor account creation error"})
                            }
                        }else{
                            // Create author 
                            db.query("INSERT INTO authors_account SET ?",[{prefix, email, firstname, lastname, othername, orcid_id, discipline, affiliations, affiliation_country, affiliation_city, is_available_for_review:'yes', is_editor:'yes', is_reviewer:'yes', password:hashedPassword, editor_invite_status:'accepted', account_status:'verified', asfi_membership_id}], async(err, data)=>{
                                if(err){
                                    return res.json({error:err})
                                }
                                const createResponse = await createEditor(email, fullname, hashedPassword, editorial_level)
                                if(createResponse == true){
                                    return res.json({success:"Editor account created succesfully"})
                                }else{
                                    return res.json({error:"editor account creation error"})
                                }
                            
                            })
                        }
                      });
              
               
              
       
          }else{
            res.json({error:"invitation not found"})
          }
        })
    }
    } catch (error) {
        console.log(error);
        return res.json({ error: error.message });
    }
}


module.exports = editorSignUp