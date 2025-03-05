const sendEmailReminder = require("../../utils/sendEmailReminder")

const remindReviewer = async (req,res) =>{
    try{
        
        // const useremail = req.params.email 
        const {manuscriptId, reviewerEmail, manuscriptTitle } = req.body
        console.log(req.body)
        const  editor_email = req.user.email
          // Convert comma-separated CC and BCC to arrays

    const subject = `REMINDER: ASFRIJ Reviewer Invitation Reminder`
    const message = `<p>Hello ${reviewerEmail},</p>
    <p>This is a reminder to submit your review on ${manuscriptTitle} (${manuscriptId})</p>`

     
        await sendEmailReminder(reviewerEmail, subject, message)
        return res.json({success:"Email sent"})
    }catch(error){
        return res.json({error:error.message})
    }
}


module.exports = remindReviewer