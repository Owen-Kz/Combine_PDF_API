
const confirmationModal = document.getElementById("exampleModal")
const shareButton = document.getElementById("shareButton")
const confirmButton  = document.getElementById("confirmButton")
const closeModal = document.getElementById("closeModal")
const preloader = document.querySelector(".preloader")

closeModal.addEventListener("click", function(){
    confirmationModal.click()
})

const domainN = "https://process.asfirj.org"

const ArticleId = document.getElementById("articleId").value
const Recipient = document.getElementById("email")
const linksContainer = document.getElementById("invitationLink")
const acceptLinkContainer = document.getElementById("acceptLinkContainer")
const declineLinkContainer = document.getElementById("declineLinkContainer")
const sendMail = document.getElementById("sendMail")



    // add the Links to the DOM when the recipient Email has changed 
    Recipient.addEventListener("change", function() {
        if(Recipient.value !== ""){
            linksContainer.innerHTML = `<span>* Click on the link to Copy</span>`
        linksContainer.innerHTML = `
        <ul>
        <li>Accept Link: <a href="#" class="copy-link" data-link="${domainN}/papers/invitations?a=${ArticleId}&e=${Recipient.value}&do=review&accept=yes">
                        ${domainN}/papers/invitations?a=${ArticleId}&e=${Recipient.value}&do=review&accept=yes
                    </a>
        </li>
        <li>Reject Link: <a href="#" class="copy-link" data-link="${domainN}/papers/invitations?a=${ArticleId}&e=${Recipient.value}&do=review&reject=yes">
                        ${domainN}/papers/invitations?a=${ArticleId}&e=${Recipient.value}&do=review&reject=yes
                    </a>
        </li>

        `
        acceptLinkContainer.innerHTML = `       "Accept Link: <a href="#" class="copy-link" data-link="${domainN}/papers/invitations?a=${ArticleId}&e=${Recipient.value}&do=review&accept=yes">
                        ${domainN}/papers/invitations?a=${ArticleId}&e=${Recipient.value}&do=review&accept=yes
                    </a>"
       `;

        declineLinkContainer.innerHTML = ` "Reject Link: <a href="#" class="copy-link" data-link="${domainN}/papers/invitations?a=${ArticleId}&e=${Recipient.value}&do=review&reject=yes">
                        ${domainN}/papers/invitations?a=${ArticleId}&e=${Recipient.value}&do=review&reject=yes
                    </a>
        "`;

 

        CopyText()

    }else{
        linksContainer.innerHTML = `<span>* The Invitation links will apppear here after the email is typed</span>`
    }
    })
CopyText()

// Send Mail event listener 
sendMail.addEventListener("submit", function(e){
    e.preventDefault();

    shareButton.click()

    confirmButton.addEventListener("click", function(){
        preloader.removeAttribute("style")

    const formData = new FormData(sendMail);
    formData.append('message', JSON.stringify(quill.getContents().ops))
    fetch(`/editors/email/inviteReviewer`,{
        method:"POST",
        body:formData,
    }).then(res=>res.json())
    .then(data=>{
        if(data.status === "success"){
            alert(data.message)
            preloader.setAttribute("style", "display:none;")
        }else{
            alert(data.message)
            preloader.setAttribute("style", "display:none;")
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
                // alert('Text copied to clipboard: ' + linkText);

        iziToast.success({
            title: `Text Copied To Clipoard`,
            message: `${linkText}`,
            position: 'topCenter'
        });
            }).catch(err => {
                console.error('Failed to copy link: ', err);
                                iziToast.error({
            title: `Failed to copy link`,
            message: `${err}`,
            position: 'topCenter'
        });
            });
        });
    })
}



