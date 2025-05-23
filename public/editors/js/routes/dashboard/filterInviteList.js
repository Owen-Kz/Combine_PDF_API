// import { GetCookie } from "../setCookie.js";


// Get a List of Availabel Reviewers 

// const userID = GetCookie("editor")
// const domainN = "https://process.asfirj.org/"
const articleID = document.getElementById("articleId").value

async function AllReviewersList(){
    return fetch(`/editors/listOfReviewerEmails`, {
        method: "POST",
        // body: JSON.stringify({
        //     editorId: userID,
        // })
    }).then(res => res.json())
    .then(data => {
        if (data.success) {
            // console.log(data.emails)
            return data.emails;
        } else {
            return [];
        }
    });
}
async function ReviewersList() {
    const res = await fetch(`/editors/listOfAuthorsForSuggestions?articleID=${articleID}`);
    const data = await res.json();
    const AuthorsList = data.authorsList;
    const AllReviewers = await AllReviewersList()
    const NotAuthorsOfThisManuscript = []

    AllReviewers.forEach(reviewer =>{
        if (!AuthorsList.includes(reviewer)){
            NotAuthorsOfThisManuscript.push(reviewer)
        }
    })

    return NotAuthorsOfThisManuscript
}

// Usage
( async () => {
   const emails = await ReviewersList();




const emailList = document.getElementById('emailList');
const emailInput = document.getElementById('email');
// const acceptLinkContainer = document.getElementById("acceptLinkContainer")
// const declineLinkContainer = document.getElementById("declineLinkContainer")

function renderEmailList(filteredEmails) {
    emailList.innerHTML = '';
    if (filteredEmails.length > 0) {
        filteredEmails.forEach(email => {
            const li = document.createElement('li');
            li.textContent = email;
            li.addEventListener('click', () => {
                emailInput.value = email;
                emailList.style.display = 'none';
                if(emailInput.value !== ""){
                    linksContainer.innerHTML = `<span>* Click on the link to Copy</span>`
                linksContainer.innerHTML = `
                <ul>
                <li>Accept Link: <a href="#" class="copy-link" data-link="${domainN}/papers/invitations?a=${articleID}&e=${emailInput.value}&do=review&accept=yes">
                                ${domainN}/papers/invitations?a=${articleID}&e=${emailInput.value}&do=review&accept=yes
                            </a>
                </li>
                <li>Reject Link: <a href="#" class="copy-link" data-link="${domainN}/papers/invitations?a=${articleID}&e=${emailInput.value}&do=review&reject=yes">
                                ${domainN}/papers/invitations?a=${articleID}&e=${emailInput.value}&do=review&reject=yes
                            </a>
                </li>
        
                `
                acceptLinkContainer.innerHTML = `       "Accept Link: <a href="#" class="copy-link" data-link="${domainN}/papers/invitations?a=${articleID}&e=${emailInput.value}&do=review&accept=yes">
                                ${domainN}/papers/invitations?a=${articleID}&e=${emailInput.value}&do=review&accept=yes
                            </a>"
               `;
        
                declineLinkContainer.innerHTML = ` "Reject Link: <a href="#" class="copy-link" data-link="${domainN}/papers/invitations?a=${articleID}&e=${emailInput.value}&do=review&reject=yes">
                                ${domainN}/papers/invitations?a=${articleID}&e=${emailInput.value}&do=review&reject=yes
                            </a>
                "`;
        
         
        
                CopyText()
        
            }else{
                linksContainer.innerHTML = `<span>* The Invitation links will apppear here after the email is typed</span>`
            }
            });
            emailList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'No item matches your search';
        li.classList.add('no-match');
        emailList.appendChild(li);
    }
}

function filterEmailList() {
    const filter = emailInput.value.toLowerCase();
    const filteredEmails = emails.filter(email => email.toLowerCase().includes(filter));
    renderEmailList(filteredEmails);
    if (emailInput.value.trim() !== '') {
        emailList.style.display = 'block';
    } else {
        emailList.style.display = 'none';
    }
}

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


emailInput.addEventListener("keyup", function(e){
    e.preventDefault()
    filterEmailList()
})

})();