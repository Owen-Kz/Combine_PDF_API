const dbPromise = require("../../../routes/dbPromise.config");
const isAdminAccount = require("../../editors/isAdminAccount");

const getEmailTemplates =  async (req, res, emailFor ) => {

    try{
const user = req.user.id

  if (user) {
    // isAdminAccount(user, (err, isAdmin) => {
    //   if (err) {
    //     return { error: 'Error checking admin status' }
    //   }

    // });
   const emailData  = await dbPromise.query("SELECT * FROM `emails_templates` WHERE `invitation_for` = ?",[emailFor])
    if(emailData[0].length > 0){
        return {success:"email", emailContent: emailData[0][0].message_body}
    }else{
        return {error:"Could not get email", emailContent:[]}
    }

  } else {
    return { error: 'User ID is required' }
  }
}catch(error){
    console.log(error)
    return {error:error.message}
}
}


module.exports = getEmailTemplates

