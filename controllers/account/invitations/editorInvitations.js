const db = require("../../../routes/db.config");
const createEditorAccount = require("./createEditorAccount");



// Helper function to check if the request is valid
const isValidRequest = (action, invitationFor, aId, uId) => {
  return action && invitationFor === "edit" && aId && uId;
};

// GET endpoint for handling invitations
const editorInvitations = async (req,res) =>{
  const accept = req.query.accept 
  const reject = req.query.reject
  let action = ""
  if(accept && accept === "yes"){
    action = "accept"
  }else if(reject && reject === "yes"){
    action = "reject"
  }
  const { do: invitationFor, a: articleId, e: userEmail } = req.query;


  // Check if all necessary query parameters are provided
  if (!isValidRequest(action, invitationFor, articleId, userEmail)) {
    return res.status(400).json({ status: 'error', message: 'Invalid Request' });
  }

  const currentTime = new Date().getTime();
  const today = new Date(currentTime).toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'

  // Query to fetch invitation details
  db.query('SELECT * FROM `invitations` WHERE `invitation_link` = ? AND `invited_user` = ?', [articleId, userEmail], (err, result) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }

    if (result.length > 0) {
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
      console.log(action)
      // If invitation is accepted or rejected
      if (action === 'accept') {

        db.query('UPDATE `invitations` SET `invitation_status` = "edit_invitation_accepted" WHERE `invitation_link` = ? AND `invited_user` = ?', [articleId, userEmail], (err) => {
          if (err) {
            return res.status(500).json({ status: 'error', message: 'Failed to accept invitation' });
          }
          // Update edit process
          db.query('UPDATE `submitted_for_edit` SET `status` = "edit_invitation_accepted" WHERE `article_id` = ? AND `editor_email` = ?', [invitationId, invitedUserEmail], async(err) => {
            if (err) {
              return res.status(500).json({ status: 'error', message: 'Failed to update edit process' });
            }
            db.query("SELECT * FROM authors_account WHERE email =?", [invitedUserEmail], async(err, authorExists)=>{
              if(err){
                console.log(err)
                return res.json({status:"error", message:err})
              }
              if(authorExists[0]){
                if(await createEditorAccount(invitedUserEmail)){
                  return res.redirect(`/editors/View?a=${invitationId}`)
                  }else{
                    return res.json({status:"error", message:"Your Invitation has been accepted but the editor account could not be created"})
                  }
              }else{
                res.redirect(`/editors/signup?a=${invitationId}`)
              }
            })
         
            // return res.status(200).json({
            //   status: 'success',
            //   message: `Invitation accepted successfully, redirecting to create account for ${invitedUserEmail}`,
            //   email: invitedUserEmail
            // });
          });
        });
      } else if (action === 'reject') {
        db.query('UPDATE `invitations` SET `invitation_status` = "invitation_rejected" WHERE `invitation_link` = ? AND `invited_user` = ?', [articleId, userEmail], (err) => {
          if (err) {
            return res.status(500).json({ status: 'error', message: 'Failed to reject invitation' });
          }
          // Update edit process
          db.query('UPDATE `submitted_for_edit` SET `status` = "invitation_rejected" WHERE `article_id` = ? AND `editor_email` = ?', [invitationId, invitedUserEmail], (err) => {
            if (err) {
              return res.status(500).json({ status: 'error', message: 'Failed to update edit process' });
            }
            return res.render("success", {status:"success", tag:"Invitation Rejected", message:"You have successfully rejected the editorial invite"})
         
          });
        });
      }else{
    return res.status(400).json({ status: 'error', message: 'Invalid Request' });
      }
    } else {
      return res.status(404).json({ status: 'error', message: 'Data Does not Exist' });
    }
  });
}

module.exports = editorInvitations