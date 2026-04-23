
const submissionsEndpoint = "/editors"
// Get a List of Availabel Reviewers 
const userID = ""
const linksContainer = document.getElementById("invitationLink")
const acceptLinkContainer = document.getElementById("acceptLinkContainer")
const declineLinkContainer = document.getElementById("declineLinkContainer")
const articleID = document.getElementById("articleId")
async function AllReviewersList(){
    return fetch(`${submissionsEndpoint}/listOfEditorEmails`, {
        method: "POST",
        body: JSON.stringify({
            editorId: userID,
        })
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
    const res = await fetch(`${submissionsEndpoint}/listOfAuthorsForSuggestions?articleID=${articleID}`);
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

( async () => {
   const emails = await ReviewersList();


const emailList = document.getElementById('emailList');
const emailInput = document.getElementById('email');

function renderEmailList(filteredEmails) {
    emailList.innerHTML = '';
    if (filteredEmails.length > 0) {
        filteredEmails.forEach(email => {
            const li = document.createElement('li');
            li.textContent = email;
            li.addEventListener('click', () => {
                emailInput.value = email;
                emailList.style.display = 'none';
                if(Recipient.value !== ""){
                    linksContainer.innerHTML = `<span>* Click on the link to Copy</span>`
                linksContainer.innerHTML = `
                <ul>
                <li>Accept Link: <a href="#" class="copy-link" data-link="${domainN}/editorInvitation?a=${articleID}&e=${Recipient.value}&do=edit&accept=yes">
                                ${domainN}/editorInvitation?a=${articleID}&e=${Recipient.value}&do=edit&accept=yes
                            </a>
                </li>
                <li>Reject Link: <a href="#" class="copy-link" data-link="${domainN}/editorInvitation?a=${articleID}&e=${Recipient.value}&do=edit&reject=yes">
                                ${domainN}/editorInvitation?a=${articleID}&e=${Recipient.value}&do=edit&reject=yes
                            </a>
                </li>
        
                `
                acceptLinkContainer.innerHTML = `       "Accept Link: <a href="#" class="copy-link" data-link="${domainN}/editorInvitation?a=${articleID}&e=${Recipient.value}&do=edit&accept=yes">
                                ${domainN}/editorInvitation?a=${articleID}&e=${Recipient.value}&do=edit&accept=yes
                            </a>"
               `;
        
                declineLinkContainer.innerHTML = ` "Reject Link: <a href="#" class="copy-link" data-link="${domainN}/editorInvitation?a=${articleID}&e=${Recipient.value}&do=edit&reject=yes">
                                ${domainN}/editorInvitation?a=${articleID}&e=${Recipient.value}&do=edit&reject=yes
                            </a>
                "`;
        
         
        
                // CopyText()
        
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

emailInput.addEventListener("keyup", function(e){
    e.preventDefault()
    filterEmailList()
})

})();