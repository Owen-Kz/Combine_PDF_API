import { GetParameters, parentDirectoryName, submissionsEndpoint } from "../constants.js";
import { formatTimestamp } from "../formatDate.js";
import { GetCookie } from "../setCookie.js";
import {getAcceptedSubmissions} from "./getAcceptedSubmissions.js"
import { GetMySubmissions } from "./getMySubmissions.js";
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

const user = GetCookie("editor");
if (user) {
    const submissionsContainer = document.getElementById("submissionsContainer");
    const paginationContainer = document.getElementById("paginationContainer");
    let currentPage = 1;
    const submissionsPerPage = 5;
    let submissionStatus = "";
    let adminAction = "";
    let tableRowClass = "";
    let reviewerInvitaitons = "";
    let editorInvitations = "";

    const authorsCount = document.querySelectorAll(".authorsCount");
    const reviewedCount = document.querySelectorAll(".reviewedCount");
    const editorInviteCount = document.querySelectorAll(".editorInviteCount");
    const stats = document.getElementById("stats");

    const SubmissionsCount = document.querySelectorAll(".submissionsCount");

    const updateCount = (selector, endpoint) => {
        fetch(`${submissionsEndpoint}/backend/editors/${endpoint}?u_id=${user}`)
            .then(res => res.json())
            .then(data => {
                selector.forEach(count => {
                    count.innerText = data.count;
                });
            });
    };

    if (SubmissionsCount) {
        updateCount(SubmissionsCount, "countSubmissions");
    }

    if (authorsCount) {
        updateCount(authorsCount, "countAuthors");
    }

    if (reviewedCount) {
        updateCount(reviewedCount, "countReviewed");
    }

    if (editorInviteCount) {
        updateCount(editorInviteCount, "countAllEditorInvites");
    }

    // Define getStatus function outside the loop
    const getStatus = (status, textColor, text, additionalClasses = "") => {
        return `
            <td class="status">
                <span class="status-text ${textColor}">${text}</span>
            </td>
            <td>${reviewerInvitaitons}</td>
            <td>${editorInvitations}</td>
            <td>
                <input type="hidden" value="${status.revision_id}" name="id">
                <a href="javascript:void(0)" onclick=archivePaper("${status.revision_id}") style="font-weight:bold;">Archive</a>
                <div class="dropdown">
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

    const loadSubmissions = async (page) => {
        const accoount_type = GetCookie("editor_account_type");
        let SubmissionsArray = [];
        if (accoount_type === "editor_in_chief" || accoount_type === "editorial_assistant") {
            SubmissionsArray = await getAcceptedSubmissions(user, page)
        } else {
            SubmissionsArray = await GetMySubmissions(user, page);
        }

        submissionsContainer.innerHTML = "";
        if (SubmissionsArray.length > 0) {
            for (const submission of SubmissionsArray) {
                const submissionRow = document.createElement('tr');
                const id = submission.revision_id;
                const isWomenInContemporarySCience = submission.is_women_in_contemporary_science
                let womenContemporaryScience = "";
                if(isWomenInContemporarySCience === 'yes'){
                    womenContemporaryScience = `<span class="isWomenIScience">Women in Contemporary Science in Africa<span>` 
                    // submissionRow.classList.add("womenInScience");
                }

                // Fetch editor and reviewer invitations
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

                // Define admin actions based on account type
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

                // Define submission status
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
                            <td>${reviewerInvitaitons}</td>
                            <td>${editorInvitations}</td>
                            <td>
                                <a href="javascript:void(0)" onclick=archivePaper("${submission.revision_id}") style="font-weight:bold;">Archive</a>
                            </td>
                            <td>
                                <a href="/editors/View/?a=${id}" style="font-weight:bold;">View</a>
                            </td>
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
                        submissionStatus = `
                            <td class="status">
                                <span class="status-text status-orange">Under Processing by author</span>
                            </td>
                            <td>${reviewerInvitaitons}</td>
                            <td>${editorInvitations}</td>
                            <td>
                                <a href="/editors/View/?a=${id}" style="font-weight:bold;">View</a>
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
                                <a href="/editors/View/?a=${id}" style="font-weight:bold;">View</a>
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
                                <a href="/editors/View/?a=${id}" style="font-weight:bold;">View</a>
                            </td>
                        `;
                        tableRowClass = "alert-item";
                        break;
                    default:
                        break;
                }

                // Add content to the row
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

                // Append the row to the container
                submissionsContainer.appendChild(submissionRow);
            }

            // Set up dropdowns after all rows are added
            setupDropdowns();
        } else {
            submissionsContainer.innerHTML = "<tr><td colspan='6'>No submissions available.</td></tr>";
        }

        updatePagination(page);
    };

    const updatePagination = (page) => {
        paginationContainer.innerHTML = "";
        const prevButton = document.createElement("button");
        prevButton.textContent = "Previous";
        prevButton.disabled = page <= 1;
        prevButton.addEventListener("click", () => loadSubmissions(page - 1));

        const pageIndicator = document.createElement("span");
        pageIndicator.textContent = ` Page ${page} `;

        const nextButton = document.createElement("button");
        nextButton.textContent = "Next";
        nextButton.addEventListener("click", () => loadSubmissions(page + 1));

        paginationContainer.appendChild(prevButton);
        paginationContainer.appendChild(pageIndicator);
        paginationContainer.appendChild(nextButton);
    };

    loadSubmissions(currentPage);
} else {
    window.location.href = `${parentDirectoryName}/dashboard`;
}

function setupDropdowns() {
    document.querySelectorAll(".dropdown").forEach((dropdown) => {
        const button = dropdown.querySelector(".actionButton");
        const menu = dropdown.querySelector(".actionMenu");

        button.addEventListener("click", (event) => {
            event.stopPropagation();
            document.querySelectorAll(".actionMenu").forEach((m) => {
                if (m !== menu) m.classList.remove("show");
            });
            menu.classList.toggle("show");
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener("click", () => {
        document.querySelectorAll(".actionMenu").forEach((menu) => {
            menu.classList.remove("show");
        });
    });
}