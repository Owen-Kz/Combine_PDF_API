const sendEmailReminder = require("../../utils/sendEmailReminder")

const remindReviewer = async (req,res) =>{
    try{
        
        // const useremail = req.params.email 
        const {manuscriptId, reviewerEmail, manuscriptTitle } = req.body
        const  editor_email = req.user.email
          // Convert comma-separated CC and BCC to arrays

    const subject = `REMINDER: ASFRIJ Reviewer Invitation Reminder`
    const message = `<p>Hello ${reviewerEmail},</p>
    <p>This is a reminder to submit your review on ${manuscriptTitle} (${manuscriptId})</p>
    <ul>
    <li>
    Accept Link: https://process.asfirj.org/papers/invitations?a=${manuscriptId}&e=${reviewerEmail}&do=review&accept=yes
    </li>
    <li>
    Reject Link: https://process.asfirj.org/papers/invitations?a=${manuscriptId}&e=${reviewerEmail}&do=review&reject=yes
    </li>
    </ul>

    `

     
        await sendEmailReminder(reviewerEmail, subject, message)
        return res.json({success:"Email sent"})
    }catch(error){
        return res.json({error:error.message})
    }
}


module.exports = remindReviewer