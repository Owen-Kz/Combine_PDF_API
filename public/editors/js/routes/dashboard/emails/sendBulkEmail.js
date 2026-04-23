const confirmationModal = document.getElementById("exampleModal")
const shareButton = document.getElementById("shareButton")
const confirmButton  = document.getElementById("confirmButton")
const closeModal = document.getElementById("closeModal")
const preloader = document.querySelector(".preloader")

closeModal.addEventListener("click", function(){
    confirmationModal.click()
})


const ArticleId = document.getElementById("articleId").value


const sendMail = document.getElementById("sendMail")
const editor = document.getElementById("editor")
const articleIDContainer = document.getElementById("articleIdContainer")

editor.value = user
articleIDContainer.value = ArticleId



CopyText()

// Send Mail event listener 
sendMail.addEventListener("submit", function(e){
    e.preventDefault();

    shareButton.click()

    confirmButton.addEventListener("click", function(){
        preloader.removeAttribute("style")
        
    const formData = new FormData(sendMail);
    formData.append('message', JSON.stringify(quill.getContents().ops))
    fetch(`/editors/email/bulkEmail`,{
        method:"POST",
        body:formData,
    }).then(res=>res.json())
    .then(data=>{
   if(data.status === "success"){
            // alert(data.message)
              iziToast.success({
            title: `Success`,
            message: `${data.message}`,
            position: 'topCenter'
        });
            // window.location.href = `${parentDirectoryName}/../Dashboard`
            preloader.setAttribute("style", "display:none;")


        }else{
            // alert(data.message)
              iziToast.error({
            title: `Error`,
            message: `${data.message}`,
            position: 'topCenter'
        });
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



