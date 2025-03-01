const db = require("../../../routes/db.config");



// Helper function to check if the request is valid
const isValidRequest = (action, invitationFor, aId, uId) => {
  return action && invitationFor === "review" && aId && uId;
};

// GET endpoint for handling invitations
const reviewerInvitation =  (req, res) => {
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
        return;
      }

      // If invitation is accepted or rejected
      if (action === 'accept') {
        db.query('UPDATE `invitations` SET `invitation_status` = "review_invitation_accepted" WHERE `invitation_link` = ? AND `invited_user` = ?', [articleId, userEmail], (err) => {
          if (err) {
            return res.status(500).json({ status: 'error', message: 'Failed to accept invitation' });
          }
          // Update the review process
          db.query('UPDATE `submitted_for_review` SET `status` = "review_invitation_accepted" WHERE `article_id` = ? AND `reviewer_email` = ?', [invitationId, invitedUserEmail], (err) => {
            if (err) {
              return res.status(500).json({ status: 'error', message: 'Failed to update review process' });
            }
            // return res.status(200).json({
            //   status: 'success',
            //   message: `Invitation accepted successfully, redirecting to create account for ${invitedUserEmail}`,
            //   email: invitedUserEmail
            // });
            return res.render("success", {status:"success", tag:"Invitation Accepted", message:"You have successfully accepted the invite"})
         
          });
        });
      } else if (action === 'reject') {
        db.query('UPDATE `invitations` SET `invitation_status` = "invitation_rejected" WHERE `invitation_link` = ? AND `invited_user` = ?', [articleId, userEmail], (err) => {
          if (err) {
            return res.status(500).json({ status: 'error', message: 'Failed to reject invitation' });
          }
          // Update the review process
          db.query('UPDATE `submitted_for_review` SET `status` = "invitation_rejected" WHERE `article_id` = ? AND `reviewer_email` = ?', [invitationId, invitedUserEmail], (err) => {
            if (err) {
              return res.status(500).json({ status: 'error', message: 'Failed to update review process' });
            }
            return res.render("success", {status:"success", tag:"Invitation Rejected", message:"You have successfully rejected the invite"})
         
          });
        });
      }
    } else {
      return res.status(404).json({ status: 'error', message: 'Data Does not Exist' });
    }
  });
}


module.exports = reviewerInvitation;