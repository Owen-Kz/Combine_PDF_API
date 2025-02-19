
import { GetParameters, domainN, parentDirectoryName, submissionsEndpoint } from "../../constants.js"
import { formatTimestamp } from "../../formatDate.js"
import { GetSubmissionData } from "../../queries/getSubmissionData.js"
import { quill } from "../../quill.js"
import { GetCookie } from "../../setCookie.js"
import { validateLogin } from "../../validateLogin.js"
import { getAuthorsDetails } from "./getAuthorsDetails.js"

const confirmationModal = document.getElementById("exampleModal")
const shareButton = document.getElementById("shareButton")
const confirmButton  = document.getElementById("confirmButton")
const closeModal = document.getElementById("closeModal")
const preloader = document.querySelector(".preloader")

closeModal.addEventListener("click", function(){
    confirmationModal.click()
})

const userFullnameContainer = document.querySelectorAll(".userFullnameContainer")
const submissionsContainer = document.getElementById("submissionsContainer")
const ArticleId = GetParameters(window.location.href).get("a")
const subjectContainer = document.getElementById("subject")
const Recipient = document.getElementById("email")
const linksContainer = document.getElementById("invitationLink")
const meetingIdContaienr = document.getElementById("meetingIdContainer");
const acceptLinkContainer = document.getElementById("acceptLinkContainer")
const declineLinkContainer = document.getElementById("declineLinkContainer")
const sendMail = document.getElementById("sendMail")
const editor = document.getElementById("editor")
const articleIDContainer = document.getElementById("articleIdContainer")
const user = GetCookie("editor")
if(user){
const AccountData = await validateLogin(user)

editor.value = user
articleIDContainer.value = ArticleId

const userFullname = AccountData.fullname 
const email = AccountData.email 
const accoount_type = AccountData.editorial_level

userFullnameContainer.forEach(container =>{
    container.innerText= userFullname
}) 


if(accoount_type === "editor_in_chief" || accoount_type === "editorial_assistant" || accoount_type === "associate_editor"){
    const ArticleData = await GetSubmissionData(ArticleId)
    if(ArticleData){
    const Title = ArticleData.title
    const CorrespondingAuthorsEmail = ArticleData.corresponding_authors_email
    const CorrespondingAuthorsName = await getAuthorsDetails(user, CorrespondingAuthorsEmail)

    Recipient.value = CorrespondingAuthorsEmail
    Recipient.setAttribute("readonly", true)

    // meetingIdContaienr.innerHTML += ` "<a href="#" class="copy-link" data-link="${ArticleId}">
    //                   ${ArticleId}
    //                 </a> "`

    // Get the Email tmplate for reviewers 
    fetch(`${submissionsEndpoint}/getReviewerEmailTemplate`, {
        method:"POST",
        body:JSON.stringify({id:user, emailFor:"reject_paper"}),
        headers:{
            "Content-type" : "application/JSON"
        }
    }).then(res=>res.json())
    .then(data=>{
        if(data.success){
            const emailContent = data.emailContent 
            const subject = emailContent.subject
            const messagebody = emailContent.message_body

            subjectContainer.value = `Reject: ${Title} (${ArticleId})`
         // Set the content as Quill Delta and extract the HTML
    quill.setContents(JSON.parse(messagebody));
        }else{
            alert(data.error)
        }
    })

    // add the Links to the DOM when the recipient Email has changed 
    // Recipient.addEventListener("change", function() {
        if(Recipient.value !== ""){
            linksContainer.innerHTML = `<span>* Click on an Item to Copy</span>`
        linksContainer.innerHTML += `
        <ul>
        <li>Manuscript Title And Id <a href="#" class="copy-link" data-link="${Title} (${ArticleId})">
                        ${Title} (${ArticleId})
                    </a>
        </li>
        <li>Corresponding Author's Name: <a href="#" class="copy-link" data-link="${CorrespondingAuthorsName}">
                        ${CorrespondingAuthorsName}
                    </a>
        </li>

        `

 

        CopyText()

    }else{
        linksContainer.innerHTML = `<span>* The Invitation links will apppear here after the email is typed</span>`
    }
    // })
CopyText()

// Send Mail event listener 
sendMail.addEventListener("submit", function(e){
    e.preventDefault();
    shareButton.click()

    confirmButton.addEventListener("click", function(){
        preloader.removeAttribute("style")
    const formData = new FormData(sendMail);
    formData.append('message', JSON.stringify(quill.getContents().ops))
    fetch(`/editors/email/rejectPaper`,{
        method:"POST",
        body:formData,
    }).then(res=>res.json())
    .then(data=>{
        if(data.status === "success"){
            alert(data.message)
            // window.location.href = `${parentDirectoryName}/../Dashboard`
            preloader.setAttribute("style", "display:none;")


        }else{
            alert(data.message)
            preloader.setAttribute("style","display:none")
        }
    })
})

})

// Copy text function 
function CopyText(){
    document.querySelectorAll('.copy-link').forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const linkText = this.getAttribute('data-link');
            navigator.clipboard.writeText(linkText).then(() => {
                alert('Text copied to clipboard: ' + linkText);
            }).catch(err => {
                console.error('Failed to copy link: ', err);
            });
        });
    })
}



    }

}


}else{

    window.location.href = `${parentDirectoryName}/workflow/accounts/login`
}