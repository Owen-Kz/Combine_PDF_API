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

import { getArchivedSubmissions } from "./getArchivedSubmissions.js";
import { GetMySubmissions } from "./getMySubmissions.js";

const user = GetCookie("editor");

if (user) {
    const userFullnameContainer = document.querySelectorAll(".userFullnameContainer");
    const submissionsContainer = document.getElementById("submissionsContainer");

    const stats = document.getElementById("stats");


  


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
        SubmissionsArray = await getArchivedSubmissions(user);
        
    } else {
        if (stats) {
            stats.style.display = "none";
        }
        SubmissionsArray = await GetMySubmissions(user);
    }

    if (SubmissionsArray.length > 0) {
        for (const submission of SubmissionsArray) {
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
                    <td>${reviewerInvitaitons}</td>
                    <td>${editorInvitations}</td>
                    <td>
                       
                            <input type="hidden" value="${submission.revision_id}" name="id">
                        
                      <div class="dropdown">
    <button class="dropdown-toggle">Actions</button>
    <ul class="dropdown-menu">
       <a href="${parentDirectoryName}/View?a=${submission.revision_id}"> <li data-action="view">View</li></a>
        ${adminAction
                        .split('\n')
                        .map((option) => {
                            const match = option.match(/value="([^"]+)">(.*?)</);
                            return match
                                ? `<a href="${parentDirectoryName}/${match[1]}?a=${submission.revision_id}"><li data-action="${match[1]}">${match[2]}</li></a>`
                                : '';
                        })
                        .join('')}
    </ul>
</div>

                       
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
                             <td>${reviewerInvitaitons}</td>
                    <td>${editorInvitations}</td>
                    <td>
                       
                   
                    </td>
                    <td>
                     <a href="../View/?a=${id}" style="font-weight:bold;">View</a>
                    </td>
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
                    submissionStatus = `
                    <td class="status">
                        <span class="status-text status-orange">Under Processing by author</span>
                    </td>
                         <td>${reviewerInvitaitons}</td>
                <td>${editorInvitations}</td>
                <td>
                   
                   
                </td>
                <td>
                 <a href="../View/?a=${id}" style="font-weight:bold;">View</a>
                </td>
                `;
                    tableRowClass = "alert-item";
                    break;
                case "revision_saved":
                    submissionStatus = `
                        <td class="status">
                            <span class="status-text status-orange">Under Processing by author</span>
                        </td>
                             <td>${reviewerInvitaitons}</td>
                    <td>${editorInvitations}</td>
                    <td>
                       
                       
                    </td>
                    <td>
                     <a href="../View/?a=${id}" style="font-weight:bold;">View</a>
                    </td>
                    `;
                    tableRowClass = "alert-item";
                    break;
                case "correction_saved":
                    submissionStatus = `
                            <td class="status">
                                <span class="status-text status-orange">Under Processing by author</span>
                            </td>
                                 <td>${reviewerInvitaitons}</td>
                        <td>${editorInvitations}</td>
                        <td>
                           
                           
                        </td>
                        <td>
                         <a href="../View/?a=${id}" style="font-weight:bold;">View</a>
                        </td>
                        `;
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


            if (submissionsContainer) {
                submissionsContainer.appendChild(submissionRow);
            }
        }
    } else {
        if (submissionsContainer) {
            submissionsContainer.innerHTML = `<tr><td>You have no manuscripts to Edit</td></tr>`;
        }
    }



    var actionBoxMain = document.querySelectorAll('.action-box');

    actionBoxMain.forEach(actionBox => {

        actionBox.addEventListener('change', (event) => {
            const id = event.target.closest("form").id.value
            const action = event.target.value;
            if (action) {
                if (action === "view") {
                    redirectTo(`View`, id);
                } else if (action === "invite_editor") {
                    redirectTo(`InviteEditor`, id);
                } else if (action === "InviteReviewer") {
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


    document.querySelectorAll('.dropdown').forEach((dropdown) => {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-menu');

        // Toggle dropdown visibility
        toggle.addEventListener('click', () => {
            menu.classList.toggle('show');
        });

        // Handle dropdown item clicks
        // menu.addEventListener('click', (event) => {
        //     const action = event.target.getAttribute('data-action');
        //     const id = dropdown.closest('form').id;

        //     if (action) {
        //         switch (action) {
        //             case 'view':
        //                 redirectTo(`View`, id);
        //                 break;
        //             case 'invite_editor':
        //                 redirectTo(`InviteEditor`, id);
        //                 break;
        //             case 'invite_reviewer':
        //                 redirectTo(`InviteReviewer`, id);
        //                 break;
        //             case 'return_for_correction':
        //                 redirectTo(`returnPaper`, id);
        //                 break;
        //             case 'return_for_revision':
        //                 redirectTo(`revisePaper`, id);
        //                 break;
        //             case 'accept':
        //                 redirectTo(`acceptPaper`, id);
        //                 break;
        //             case 'reject':
        //                 redirectTo(`rejectPaper`, id);
        //                 break;
        //         }
        //     }

        //     // Close the dropdown after selection
        //     menu.classList.remove('show');
        // });

        // Close dropdown if clicked outside
        document.addEventListener('click', (event) => {
            if (!dropdown.contains(event.target)) {
                menu.classList.remove('show');
            }
        });
    });


} else {
    window.location.href = `${parentDirectoryName}/workflow/accounts/login`;
}
