// Add this near the top of your script
document.addEventListener('DOMContentLoaded', function() {
    // Event delegation for dropdowns
    document.body.addEventListener('click', function(event) {
        // Check if click is on a dropdown button
        if (event.target.matches('.dropdown-toggle.actionButton') || 
            event.target.closest('.dropdown-toggle.actionButton')) {
            const button = event.target.matches('.dropdown-toggle.actionButton') ? 
                event.target : 
                event.target.closest('.dropdown-toggle.actionButton');
            const dropdown = button.closest('.dropdown');
            const menu = dropdown.querySelector('.actionMenu');
            
            event.stopPropagation();
            
            // Close all other dropdowns
            document.querySelectorAll('.actionMenu').forEach(m => {
                if (m !== menu) m.classList.remove('show');
            });
            
            // Toggle current dropdown
            menu.classList.toggle('show');
        }
        // Close dropdowns when clicking outside
        else if (!event.target.closest('.dropdown')) {
            document.querySelectorAll('.actionMenu').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });
});

// Set Cookie 
const hoursToKeep = 1;  // Desired duration in hours
const daysToKeep = hoursToKeep / 24;  // Convert hours to days
const expirationDays = daysToKeep > 0 ? daysToKeep : 1;  // Ensure a minimum of 1 day

const  SetCookies = function setCookie(name, value, daysToExpire) {
    const date = new Date();
    date.setTime(date.getTime() + (daysToExpire * 24 * 60 * 60 * 1000));
    const expires = 'expires=' + date.toUTCString();
    document.cookie = name + '=' + value + '; ' + expires + '; path=/';
}

const GetCookie = function getCookie(cookieName) {
    const name = cookieName + "=";
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookieArray = decodedCookie.split(';');
    for (let i = 0; i < cookieArray.length; i++) {
        let cookie = cookieArray[i];
        while (cookie.charAt(0) == ' ') {
            cookie = cookie.substring(1);
        }
        if (cookie.indexOf(name) == 0) {
            return cookie.substring(name.length, cookie.length);
        }
    }
    return null; // Cookie not found
}

const DeleteCookie = function deleteCookie(cookieName) {
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    window.location.reload()
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
  
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const day = date.getDate(); // Numeric day of the month
    const year = date.getFullYear();
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
  
    return `${day} ${monthName}, ${year}`;
  }

// import { GetCookie } from "../setCookie.js";
// import { GetAdminSubmissions } from "./getAdminSubmissions.js";
// import { GetMySubmissions } from "./getMySubmissions.js";
// import {
//     countAcceptedEditorInvitations,
//     CountRejectedEditorInvitaitons,
//     CountTotalEditorInvitaitons
// } from "./countEditorInvitations.js";
// import {
//     countAcceptedReviewerInvitations,
//     CountRejectedReviewerInvitaitons,
//     CountTotalReviewerInvitaitons
// } from "./countReviewerInvitations.js";

const user = GetCookie("editor");
// if (user) {
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
        fetch(`/editors/backend/editors/${endpoint}?u_id=${user}`)
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
            <a href="/editors/View/?a=${status.revision_id}" style="font-weight:bold;">View</a>
        </td>
        <td>
            <input type="hidden" value="${status.revision_id}" name="id">
            <a href="javascript:void(0)" onclick=archivePaper("${status.revision_id}") style="font-weight:bold;">Archive</a>
            <div class="dropdown">
                <button class="dropdown-toggle actionButton" type="button">Actions</button>
                <ul class="dropdown-menu actionMenu">
                    <li><a href="/editors/View?a=${status.revision_id}">View</a></li>
                    ${adminAction
                        .split('\n')
                        .map((option) => {
                            const match = option.match(/value="([^"]+)">(.*?)</);
                            return match
                                ? `<li><a href="/editors/${match[1]}?a=${status.revision_id}">${match[2]}</a></li>`
                                : '';
                        })
                        .join('')}
                </ul>
            </div>
        </td>
    `;
};

 // Modify your loadSubmissions function to accept search query
const loadSubmissions = async (page, searchQuery = '') => {
    const accoount_type = GetCookie("editor_account_type");
    let SubmissionsArray = [];
    
    try {
        if (accoount_type === "editor_in_chief" || accoount_type === "editorial_assistant") {
            SubmissionsArray = await GetAdminSubmissions(user, page, searchQuery);
        } else {
            SubmissionsArray = await GetMySubmissions(user, page, searchQuery);
        }

        renderSubmissions(SubmissionsArray,accoount_type, page, !!searchQuery);
    } catch (error) {
        console.error('Error loading submissions:', error);
        submissionsContainer.innerHTML = '<tr><td colspan="6">Error loading submissions</td></tr>';
    }
};

async function renderSubmissions(submissionsArray, accoount_type, page, isSearch = false) {
    submissionsContainer.innerHTML = "";
    
    if (submissionsArray.length > 0) {
          if (submissionsArray.length > 0) {
            for (const submission of submissionsArray) {
                const submissionRow = document.createElement('tr');
                const id = submission.revision_id;
                const isWomenInContemporarySCience = submission.is_women_in_contemporary_science
                let womenContemporaryScience = "";
                if(isWomenInContemporarySCience === 'yes'){
                    womenContemporaryScience = `<span class="isWomenIScience">Women in Contemporary Science in Africa<span>` 
                    // submissionRow.classList.add("womenInScience");
                }else{
                    // submissionRow.classList.add("notWomenInScience");
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
                    <td style="width: 400px; max-width:400px; min-width: 300px;">
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
        
        setupDropdowns();
    } else {
        const message = isSearch ? 
            `No results found for "${currentSearchQuery}"` : 
            'No submissions available';
        submissionsContainer.innerHTML = `<tr><td colspan="6">${message}</td></tr>`;
    }
    
    updatePagination(page, isSearch);
}
// Update your pagination function
const updatePagination = (page, isSearch = false) => {
    paginationContainer.innerHTML = "";
    
    const prevButton = document.createElement("button");
    prevButton.textContent = "Previous";
    prevButton.disabled = page <= 1;
    prevButton.addEventListener("click", () => {
        loadSubmissions(page - 1, isSearch ? currentSearchQuery : '');
    });

    const pageIndicator = document.createElement("span");
    pageIndicator.textContent = ` Page ${page} `;

    const nextButton = document.createElement("button");
    nextButton.textContent = "Next";
    nextButton.addEventListener("click", () => {
        loadSubmissions(page + 1, isSearch ? currentSearchQuery : '');
    });

    paginationContainer.appendChild(prevButton);
    paginationContainer.appendChild(pageIndicator);
    paginationContainer.appendChild(nextButton);
};

   
    // initializeSearch();
    loadSubmissions(currentPage);
    // setupDropdowns();

// } else {
//     window.location.href = `/editors/dashboard`;
// }

function setupDropdowns() {
    // Remove existing event listeners to prevent duplicates
    document.querySelectorAll(".dropdown-toggle.actionButton").forEach(button => {
        button.removeEventListener("click", handleDropdownClick);
    });
    
    document.removeEventListener("click", handleDocumentClick);

    // Add new event listeners
    document.querySelectorAll(".dropdown-toggle.actionButton").forEach(button => {
        button.addEventListener("click", handleDropdownClick);
    });
    
    document.addEventListener("click", handleDocumentClick);
}

// Separate handler functions for better management
function handleDropdownClick(event) {
    event.stopPropagation();
    event.preventDefault();
    
    const dropdown = this.closest(".dropdown");
    const menu = dropdown.querySelector(".actionMenu");
    
    // Close all other dropdowns
    document.querySelectorAll(".actionMenu").forEach(m => {
        if (m !== menu) m.classList.remove("show");
    });
    
    // Toggle current dropdown
    menu.classList.toggle("show");
}

function handleDocumentClick() {
    // Close all dropdowns when clicking outside
    document.querySelectorAll(".actionMenu").forEach(menu => {
        menu.classList.remove("show");
    });
}