const editorInvitations = require("../../account/invitations/editorInvitations")
const reviewerInvitation = require("../../account/invitations/reviewerINvite")

const InvitationsPage = async (req,res) =>{
    try{
        if(req.query.invite_for){
            const invite = req.query.invite_for

            if(invite == "review"){
                return reviewerInvitation(req,res)
            }else if(invite == "edit"){
                return editorInvitations(req,res)
            }

        }else{
            return res.render("success", {status:"error", tag: "Invalid Parameters", message:"Please check the link and try again"})
        }

    }catch(error){
        console.log(error)
        return res.json({error:error.message})
    }

}

module.exports = InvitationsPage