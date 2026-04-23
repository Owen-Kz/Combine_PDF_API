const deleteSubmissionSession = async (req,res) =>{
// In your submission endpoint (SubmitDisclosures or similar)
const userID  = req.user

    // Clear session to force new submission on next request
    if (req.session && req.user.email === req.session.manuscriptData?.corresponding_authors_email) {
        delete req.session?.articleId;
        delete req.session.manuscriptData;
        req.session.forceNewSubmission = true; // Or set a flag
    }
  return  res.redirect(`/uploadManuscript?_uid=${req.user.email}&prg=true`)

}

module.exports = deleteSubmissionSession