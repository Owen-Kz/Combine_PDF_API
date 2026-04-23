
function GetParameters(href){
    // Get the URL string
    const urlString = href;
    
    // Create a URL object
    const url = new URL(urlString);
    
    // Get the search parameters from the URL
    const searchParams = new URLSearchParams(url.search);
    return searchParams
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

const user = GetCookie("editor");

async function StartDropDown(){
if(user){

const accoount_type = GetCookie("editor_account_type");


const dropDown = document.getElementById("dropDown")
const ArticleId = GetParameters(window.location.href).get("a")
let adminAction = accoount_type === "editor_in_chief" || accoount_type === "editorial_assistant" ?
`
    <a href="../returnPaper?a=${ArticleId}"> <li data-action="return_for_correction">Return For Correction</li></a>
    <a href="../revisePaper?a=${ArticleId}"> <li data-action="revise_paper">Revise</li></a>
    <a href="../InviteReviewer?a=${ArticleId}"> <li data-action="invite_reviewer">Invite Reviewer</li></a>
    <a href="../InviteEditor?a=${ArticleId}"> <li data-action="invite_editor">Invite Editor</li></a>
    <a href="../acceptPaper?a=${ArticleId}"> <li data-action="acceptPaper">Accept</li></a>
    <a href="../rejectPaper?a=${ArticleId}"> <li data-action="reject_paper">Reject</li></a>
` :
`
    <a href="../InviteReviewer?a=${ArticleId}"> <li data-action="invite_reviewer">Invite Reviewer</li></a>
    <a href="../revisePaper?a=${ArticleId}"> <li data-action="revise_paper">Revise</li></a>
    <a href="../acceptPaper?a=${ArticleId}"> <li data-action="accept_paper">Accept</li></a>
    <a href="../rejectPaper?a=${ArticleId}"> <li data-action="reject_paper">Reject</li></a>
`;
dropDown.innerHTML = `
<a href="../View?a=${ArticleId}"> <li data-action="view">View</li></a>
${adminAction}
`
}
}

StartDropDown()