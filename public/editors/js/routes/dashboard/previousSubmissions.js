import { GetParameters, parentDirectoryName, submissionsEndpoint } from "../constants.js";
import { formatTimestamp } from "../formatDate.js";
import { GetCookie } from "../setCookie.js";
import { validateLogin } from "../validateLogin.js";
// import { 
//     countAcceptedEditorInvitations, 
//     CountRejectedEditorInvitations, 
//     CountTotalEditorInvitations 
// } from "./countEditorInvitations.js";
// import { 
//     countAcceptedReviewerInvitations, 
//     CountRejectedReviewerInvitations, 
//     CountTotalReviewerInvitations 
// } from "./countReviewerInvitations.js";
import { GetMyPreviousSubmissions } from "./getMyPreviousSubmissions.js";
import { GetPreviousAdminSubmissions } from "./getPreviousAdminSubmissions.js";


async function countAcceptedReviewerInvitations(article_id){
    return fetch(`/editors/countAcceptedReviewerInvitations?a_id=${article_id}`,{})
    .then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.count
            
        }else{
            console.log(data.error)
        }
    })
}

async function CountRejectedReviewerInvitations(article_id){
    return fetch(`/editors/countRejectedReviewerInvitations?a_id=${article_id}`,{})
    .then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.count
        }else{
            console.log(data.error)
        }
    })
}

async function CountTotalReviewerInvitations(article_id){
    return fetch(`/editors/countTotalReviewerInvitations?a_id=${article_id}`,{})
    .then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.count
        }else{
            console.log(data.error)
        }
    })
}



async function countAcceptedEditorInvitations(article_id){
    return fetch(`/editors/countAcceptedEditorInvitations?a_id=${article_id}`,{})
    .then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.count
            
        }else{
            console.log(data.error)
        }
    })
}

async function CountRejectedEditorInvitations(article_id){
    return fetch(`/editors/countRejectedEditorInvitations?a_id=${article_id}`,{})
    .then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.count
        }else{
            console.log(data.error)
        }
    })
}

async function CountTotalEditorInvitations(article_id){
    return fetch(`/editors/countTotalEditorInvitations?a_id=${article_id}`,{})
    .then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.count
        }else{
            console.log(data.error)
        }
    })
}


const user = GetCookie("editor");

if (user) {
const userFullnameContainer = document.querySelectorAll(".userFullnameContainer");
const submissionsContainer = document.getElementById("submissionsContainer");

const stats = document.getElementById("stats");


 const submissionId = GetParameters(window.location.href).get("a")

 const str = submissionId;

 const result = str.substring(0, str.lastIndexOf('.')) ? str.substring(0, str.lastIndexOf('.')) : submissionId;

    const AccountData = await validateLogin(user);
    const userFullname = AccountData.fullname;
    const email = AccountData.email;
    const accoount_type = AccountData.editorial_level;

    userFullnameContainer.forEach(container => {
        container.innerText = userFullname;
    });

    let SubmissionsArray = [];
    let submissionStatus = "";
    let adminAction = "";
    let tableRowClass = "";
    let reviewerInvitations = "";
    let editorInvitations = "";

    const redirectTo = (path, id) => {
        window.location.href = `${parentDirectoryName}/${path}?a=${id}`;
    };

    if (accoount_type === "editor_in_chief" || accoount_type === "editorial_assistant") {
        SubmissionsArray = await GetPreviousAdminSubmissions(user, submissionId)
    } else {
        if (stats) {
            stats.style.display = "none";
        }
        SubmissionsArray = await GetMyPreviousSubmissions(user, result)
    }

    if (SubmissionsArray.length > 0) {
        
        SubmissionsArray.forEach(async submission => {
            if(!submission || submission === null){
            
            }else{
                const isWomenInContemporarySCience = submission.is_women_in_contemporary_science
                let womenContemporaryScience = "";
                if(isWomenInContemporarySCience === 'yes'){
                    womenContemporaryScience = `<span class="isWomenIScience">Women in Contemporary Science in Africa<span>` 
                    // submissionRow.classList.add("womenInScience");
                }

            const id = submission.revision_id;
            editorInvitations = `
                <ul>
                    <li>Accepted: ${await countAcceptedEditorInvitations(id)}</li>
                    <li>Declined: ${await CountRejectedEditorInvitations(id)}</li>
                    <li>Pending: ${await CountTotalEditorInvitations(id)}</li>
                </ul>
            `;
            reviewerInvitations = `
                <ul>
                    <li>Accepted: ${await countAcceptedReviewerInvitations(id)}</li>
                    <li>Declined: ${await CountRejectedReviewerInvitations(id)}</li>
                    <li>Pending: ${await CountTotalReviewerInvitations(id)}</li>
                </ul>
            `;
            adminAction = accoount_type === "editor_in_chief" || accoount_type === "editorial_assistant" ?
                `
                    <option value="returnPaper">Return For Correction</option>
                    <option value="revisePaper">Revise</option>
                    <option value="InviteReviewer">Invite Reviewer</option>
                    <option value="InviteEditor">Invite Editor</option>
                    <option value="acceptPaper">Accept</option>
                    <option value="rejectPaper">Reject</option>
                ` :
                `
                    <option value="InviteReviewer">Invite Reviewer</option>
                    <option value="revisePaper">Revise</option>
                    <option value="acceptPaper">Accept</option>
                    <option value="rejectPaper">Reject</option>
                `;

              const getStatus = (status, textColor, text, additionalClasses = "") => {

                
        return `
            <td class="status">
                <span class="status-text ${textColor}">${text}</span>
            </td>
            <td>${reviewerInvitations}</td>
            <td>${editorInvitations}</td>
            <td>
                <input type="hidden" value="${status.revision_id}" name="id">
                <a href="javascript:void(0)" onclick=archivePaper("${status.revision_id}") style="font-weight:bold;">Archive</a>
                <div class="dropdown " onclick=startDropDown('${status.id}') id="${status.id}">
                    <button class="dropdown-toggle actionButton">Actions</button>
                    <ul class="dropdown-menu actionMenu">
                        <a href="${parentDirectoryName}/View?a=${status.revision_id}">
                            <li data-action="view">View</li>
                        </a>
                        ${adminAction
                            .split('\n')
                            .map((option) => {
                                const match = option.match(/value="([^"]+)">(.*?)</);
                                return match
                                    ? `<a href="${parentDirectoryName}/${match[1]}?a=${status.revision_id}"><li data-action="${match[1]}">${match[2]}</li></a>`
                                    : '';
                            })
                            .join('')}
                    </ul>
                </div>
            </td>
            <td>
                <a href="/editors/View/?a=${status.revision_id}" style="font-weight:bold;">View</a>
            </td>
        `;

    };

            switch (submission.status) {
                case "submitted_for_review":
                    submissionStatus = getStatus(submission, "status-orange", "Awaiting to be Reviewed");
                    tableRowClass = "";
                    break;
                case "submitted_for_edit":
                    submissionStatus = getStatus(submission, "status-orange", "Awaiting to be Edited");
                    tableRowClass = "";
                    break;
                case "returned_for_revision":
                    submissionStatus = getStatus(submission, "status-orange", "Returned For Revision", "danger-item");
                    tableRowClass = "danger-item";
                    break;
                case "returned_for_correction":
                    submissionStatus = getStatus(submission, "status-orange", "Returned For Correction", "danger-item");
                    tableRowClass = "danger-item";
                    break;
                case "rejected":
                    submissionStatus = getStatus(submission, "status-red", "Rejected", "danger-item");
                    tableRowClass = "danger-item";
                    break;
                case "accepted":
                    submissionStatus = `
                        <td class="status">
                            <span class="status-text status-green">Accepted</span>
                        </td>
                        <td></td>
                    `;
                    tableRowClass = "";
                    break;
                case "review_submitted":
                case "review_completed":
                    submissionStatus = getStatus(submission, "status-blue", "Awaiting to be Published");
                    tableRowClass = "";
                    break;
                case "revision_submitted":
                    submissionStatus = getStatus(submission, "status-blue", `Revision for ${submission.article_id}`, "success-item");
                    tableRowClass = "success-item";
                    break;
                case "submitted":
                    submissionStatus = getStatus(submission, "status-blue", "New Submission", "success-item");
                    tableRowClass = "success-item";
                    break;
                case "correction_submitted":
                    submissionStatus = getStatus(submission, "status-blue", "Correction Submitted", "success-item");
                    tableRowClass = "success-item";
                    break;
                case "saved_for_later":
                    submissionStatus = getStatus(submission, "status-orange", "Under Processing by author", "alert-item");
                    tableRowClass = "alert-item";
                    break;
                case "revision_saved":
                    submissionStatus = getStatus(submission, "status-orange", "Under Processing by author", "success-item");
                    tableRowClass = "alert-item";
                     break;
                default:
                    break;
                    
            }

            const submissionRow = document.createElement('tr');
            submissionRow.className = tableRowClass;
            submissionRow.innerHTML = `
                <td>
                    <p>Title</p>
                    <p>${submission.title}</p>
                    <p>${womenContemporaryScience}</p>
                </td>
                <td>
                    <p>${formatTimestamp(submission.date_submitted)}</p>
                    <p class="text-danger">${submission.revision_id}</p>
                </td>
                ${submissionStatus}
            `;
        
           
     
if(submissionsContainer){
            submissionsContainer.appendChild(submissionRow);
}
        
            }}
    )
    } else {
        if(submissionsContainer){
        submissionsContainer.innerHTML = `<tr><td>You have no manuscripts to Edit</td></tr>`;
        }
    }



//     var actionBoxMain = document.querySelectorAll('.action-box');
    
//     actionBoxMain.forEach(actionBox =>{
 
//     actionBox.addEventListener('change', (event) => {
//         const id = event.target.closest("form").id.value
//         const action = event.target.value;
//         if (action) {
//             if (action === "view") {
//                 redirectTo(`View`, id);
//             } else if (action === "InviteEditor") {
//                 redirectTo(`InviteEditor`, id);
//             } else if (action === "InviteReviewer") {
//                 redirectTo(`InviteReviewer`, id);
//             } else if (action === "returnPaper") {
//                 redirectTo(`returnPaper`, id);
//             } else if (action === "revisePaper") {
//                 redirectTo(`revisePaper`, id);
//             } else if (action === "accept") {
//                 redirectTo(`acceptPaper`, id);
//             } else if (action === "reject") {
//                 redirectTo(`rejectPaper`, id);
//              } 
//         }
//     });
// })

} else {
    window.location.href = `${parentDirectoryName}/workflow/accounts/login`;
}
