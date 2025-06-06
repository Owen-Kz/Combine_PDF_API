// Set Cookie 
const hoursToKeep = 1;  // Desired duration in hours
const daysToKeep = hoursToKeep / 24;  // Convert hours to days
const expirationDays = daysToKeep > 0 ? daysToKeep : 1;  // Ensure a minimum of 1 day

const SetCookies = function setCookie(name, value, daysToExpire) {
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

const user = GetCookie("editor");
// if (user) {
    const submissionsContainer = document.getElementById("submissionsContainer");
    const paginationContainer = document.getElementById("paginationContainer");
    const searchInput = document.getElementById("searchInput");
    let currentPage = 1;
    const submissionsPerPage = 5;
    // let currentSearchQuery = '';
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

    if (SubmissionsCount) updateCount(SubmissionsCount, "countSubmissions");
    if (authorsCount) updateCount(authorsCount, "countAuthors");
    if (reviewedCount) updateCount(reviewedCount, "countReviewed");
    if (editorInviteCount) updateCount(editorInviteCount, "countAllEditorInvites");

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
                        <a href="/editors/View?a=${status.revision_id}">
                            <li data-action="view">View</li>
                        </a>
                        ${adminAction
                            .split('\n')
                            .map((option) => {
                                const match = option.match(/value="([^"]+)">(.*?)</);
                                return match
                                    ? `<a href="/editors/${match[1]}?a=${status.revision_id}"><li data-action="${match[1]}">${match[2]}</li></a>`
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

    const loadSubmissions = async (page, searchQuery = '') => {
        const accoount_type = GetCookie("editor_account_type");
        let SubmissionsArray = [];
        
        if (accoount_type === "editor_in_chief" || accoount_type === "editorial_assistant") {
            SubmissionsArray = await getAcceptedSubmissions(user, page, searchQuery);
        } else {
            SubmissionsArray = await GetMySubmissions(user, page, searchQuery);
        }

        renderSubmissions(SubmissionsArray, accoount_type, page, searchQuery);
    };

    const renderSubmissions = async (submissions, accoount_type, page, searchQuery = '') => {
        submissionsContainer.innerHTML = "";
        
        if (submissions.length > 0) {
            for (const submission of submissions) {
                const submissionRow = document.createElement('tr');
                const id = submission.revision_id;
                const isWomenInContemporarySCience = submission.is_women_in_contemporary_science;
                let womenContemporaryScience = "";
                
                if(isWomenInContemporarySCience === 'yes') {
                    womenContemporaryScience = `<span class="isWomenIScience">Women in Contemporary Science in Africa<span>`;
                }

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

                submissionsContainer.appendChild(submissionRow);
            }
            
            setupDropdowns();
        } else {
            const noResultsMessage = searchQuery ? 
                `No submissions found for "${searchQuery}"` : 
                'No submissions available';
            submissionsContainer.innerHTML = `<tr><td colspan="6">${noResultsMessage}</td></tr>`;
        }
        
        updatePagination(page, searchQuery);
    };

    const updatePagination = (page, searchQuery = '') => {
        paginationContainer.innerHTML = "";
        
        const prevButton = document.createElement("button");
        prevButton.textContent = "Previous";
        prevButton.disabled = page <= 1;
        prevButton.addEventListener("click", () => {
            loadSubmissions(page - 1, searchQuery);
        });

        const pageInfo = document.createElement("span");
        pageInfo.textContent = `Page ${page}`;

        const nextButton = document.createElement("button");
        nextButton.textContent = "Next";
        nextButton.addEventListener("click", () => {
            loadSubmissions(page + 1, searchQuery);
        });

        paginationContainer.appendChild(prevButton);
        paginationContainer.appendChild(pageInfo);
        paginationContainer.appendChild(nextButton);
    };

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

        document.addEventListener("click", () => {
            document.querySelectorAll(".actionMenu").forEach((menu) => {
                menu.classList.remove("show");
            });
        });
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener("keyup", (e) => {
            if (e.key === "Enter") {
                currentSearchQuery = searchInput.value.trim();
                loadSubmissions(1, currentSearchQuery);
            }
        });

        const searchButton = document.getElementById("searchButton");
        if (searchButton) {
            searchButton.addEventListener("click", () => {
                currentSearchQuery = searchInput.value.trim();
                loadSubmissions(1, currentSearchQuery);
            });
        }
    }

    // Initial load
    loadSubmissions(currentPage);
// } else {
//     window.location.href = `/editors/dashboard`;
// }