import { GetParameters, parentDirectoryName, submissionsEndpoint } from "../constants.js";
import { formatTimestamp } from "../formatDate.js";
import { GetCookie } from "../setCookie.js";
import { validateLogin } from "../validateLogin.js";
import { 
    countAcceptedEditorInvitations, 
    CountRejectedEditorInvitaitons, 
    CountTotalEditorInvitaitons 
} from "./countEditorInvitations.js";
import { 
    countAcceptedReviewerInvitations, 
    CountRejectedReviewerInvitaitons, 
    CountTotalReviewerInvitaitons 
} from "./countReviewerInvitations.js";
import { GetMyPreviousSubmissions } from "./getMyPreviousSubmissions.js";
import { GetPreviousAdminSubmissions } from "./getPreviousAdminSubmissions.js";

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
    let reviewerInvitaitons = "";
    let editorInvitations = "";

    const redirectTo = (path, id) => {
        window.location.href = `${parentDirectoryName}/${path}?a=${id}`;
    };

    if (accoount_type === "editor_in_chief" || accoount_type === "editorial_assistant") {
        SubmissionsArray = await GetPreviousAdminSubmissions(user, result)
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

            const id = submission.revision_id;
            editorInvitations = `
                <ul>
                    <li>Accepted: ${await countAcceptedEditorInvitations(id)}</li>
                    <li>Declined: ${await CountRejectedEditorInvitaitons(id)}</li>
                    <li>Pending: ${await CountTotalEditorInvitaitons(id)}</li>
                </ul>
            `;
            reviewerInvitaitons = `
                <ul>
                    <li>Accepted: ${await countAcceptedReviewerInvitations(id)}</li>
                    <li>Declined: ${await CountRejectedReviewerInvitaitons(id)}</li>
                    <li>Pending: ${await CountTotalReviewerInvitaitons(id)}</li>
                </ul>
            `;
            adminAction = accoount_type === "editor_in_chief" || accoount_type === "editorial_assistant" ?
                `
                    <option value="return_for_correction">Return For Correction</option>
                    <option value="return_for_revision">Revise</option>
                    <option value="invite_reviewer">Invite Reviewer</option>
                    <option value="invite_editor">Invite Editor</option>
                    <option value="accept">Accept</option>
                    <option value="reject">Reject</option>
                ` :
                `
                    <option value="invite_reviewer">Invite Reviewer</option>
                    <option value="return_for_revision">Revise</option>
                    <option value="accept">Accept</option>
                    <option value="reject">Reject</option>
                `;

            const getStatus = (status, textColor, text, additionalClasses = "") => {
                return `
                    <td class="status">
                        <span class="status-text ${textColor}">${text}</span>
                    </td>
                    <td>${reviewerInvitaitons}</td>
                    <td>${editorInvitations}</td>
                    <td>
                        <form class="form" id="${submission.revision_id}">
                            <input type="hidden" value="${submission.revision_id}" name="id">
                        
                            <select class="action-box" name="do">
                                <option value="Select An Action">Actions</option>
                                <option value="view">View</option>
                                ${adminAction}
                            </select>
                        </form>
                    </td>
                    <td>
                     <a href="../View/?a=${id}" style="font-weight:bold;">View</a>
                    </td>
                `;
            };

            switch (submission.status) {
                case "submitted_for_review":
                    submissionStatus = getStatus(submission.status, "status-orange", "Awaiting to be Reviewed");
                    tableRowClass = "";
                    break;
                case "submitted_for_edit":
                    submissionStatus = getStatus(submission.status, "status-orange", "Awaiting to be Edited");
                    tableRowClass = "";
                    break;
                case "returned_for_revision":
                    submissionStatus = getStatus(submission.status, "status-orange", "Returned For Revision", "danger-item");
                    tableRowClass = "danger-item";
                    break;
                case "returned_for_correction":
                    submissionStatus = getStatus(submission.status, "status-orange", "Returned For Correction", "danger-item");
                    tableRowClass = "danger-item";
                    break;
                case "rejected":
                    submissionStatus = getStatus(submission.status, "status-red", "Rejected", "danger-item");
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
                    submissionStatus = getStatus(submission.status, "status-blue", "Awaiting to be Published");
                    tableRowClass = "";
                    break;
                case "revision_submitted":
                    submissionStatus = getStatus(submission.status, "status-blue", `Revision for ${submission.article_id}`, "success-item");
                    tableRowClass = "success-item";
                    break;
                case "submitted":
                    submissionStatus = getStatus(submission.status, "status-blue", "New Submission", "success-item");
                    tableRowClass = "success-item";
                    break;
                case "correction_submitted":
                    submissionStatus = getStatus(submission.status, "status-blue", "Correction Submitted", "success-item");
                    tableRowClass = "success-item";
                    break;
                case "saved_for_later":
                    submissionStatus = getStatus(submission.status, "status-orange", "Under Processing by author", "alert-item");
                    tableRowClass = "alert-item";
                    break;
                case "revision_saved":
                    submissionStatus = getStatus(submission.status, "status-orange", "Under Processing by author", "success-item");
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



    var actionBoxMain = document.querySelectorAll('.action-box');
    
    actionBoxMain.forEach(actionBox =>{
 
    actionBox.addEventListener('change', (event) => {
        const id = event.target.closest("form").id.value
        const action = event.target.value;
        if (action) {
            if (action === "view") {
                redirectTo(`View`, id);
            } else if (action === "invite_editor") {
                redirectTo(`InviteEditor`, id);
            } else if (action === "invite_reviewer") {
                redirectTo(`InviteReviewer`, id);
            } else if (action === "return_for_correction") {
                redirectTo(`returnPaper`, id);
            } else if (action === "return_for_revision") {
                redirectTo(`revisePaper`, id);
            } else if (action === "accept") {
                redirectTo(`acceptPaper`, id);
            } else if (action === "reject") {
                redirectTo(`rejectPaper`, id);
             } 
        }
    });
})


} else {
    window.location.href = `${parentDirectoryName}/workflow/accounts/login`;
}
