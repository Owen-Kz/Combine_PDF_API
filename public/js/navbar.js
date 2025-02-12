// import { editorsDomainEndpoint, parentDirectoryName, submissionsEndpoint, url } from "../constants.js";
// import { GetCookie } from "../setCookie.js";
// import { GetAccountData } from "./accountData.js";

// const email = GetCookie("user");

const editorsDomainEndpoint = "https://editors.asfirj.org" 
const parentDirectoryName = "https://asfirj.org"
const url = window.location.href

function GetAccountData(){
    return fetch(`/getUserInfo`, {
        method:"GET"
    }).then(res =>res.json())
    .then(data =>{
        return data.user
    })
}

// if(email){
const userInfo = await GetAccountData()
const email = userInfo.email
const navbarContainer = document.getElementById("navbarContainer")
let homeActive, authorActive, reviewerActive, inboxActive = ""
const reviewerdashPattern = new RegExp(`^/dashboard/reviewerdash/.*$`);
const authordashPattern = new RegExp(`^/dashboard/authordash/.*$`);
const maildashPattern = new RegExp(`^/dashboard/mail/.*$`);




if(url.pathname === `${parentDirectoryName}/dashboard/authordash/` || url.pathname === `/dashboard/authordash/`){
// navbarContainer.innerHTML = homeNavbar
homeActive = "nav-active"
authorActive = "not-active"
reviewerActive = "not-active"
inboxActive = "not-active"

}else if(authordashPattern.test(url.pathname)){
    homeActive = "not-active"
    authorActive = "nav-active"
    reviewerActive = "not-active"
    inboxActive = "not-active"
}else if(reviewerdashPattern.test(url.pathname)) {
    homeActive = "not-active"
    authorActive = "not-active"
    reviewerActive = "nav-active"
    inboxActive = "not-active"
}else if(maildashPattern.test(url.pathname)){
    homeActive = "not-active"
    authorActive = "not-active"
    reviewerActive = "not-active"
    inboxActive = "nav-active"
}
const homeNavbar = `<div style="display: flex;" class="dash-nav">
                    <a href="${parentDirectoryName}/dashboard/authordash" class="${homeActive}"><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='las la-home text--danger'></i>Home </span></a>
                    <a href="${parentDirectoryName}/dashboard/authordash/manuscripts" class="${authorActive}"><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='las la-pen text--danger'></i> Author </span></a>
                     <a href="${parentDirectoryName}/dashboard/mail/inbox" class="${inboxActive}"><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='fa fa-envelope text--danger'></i> Inbox</span></a>
                </div>
            </div>`
const authorNavbar = `<div style="display: flex;" class="dash-nav">
                    <a href="${parentDirectoryName}/dashboard/authordash" class="${homeActive}"><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='las la-home text--danger'></i>Home </span></a>
                    <a href="${parentDirectoryName}/dashboard/authordash/manuscripts" class="${authorActive}"><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='las la-pen text--danger'></i> Author </span></a>
                     <a href="${parentDirectoryName}/dashboard/mail/inbox" class="${inboxActive}"><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='fa fa-envelope text--danger'></i> Inbox</span></a>
                       <a href="${parentDirectoryName}/portal/settings" class="${inboxActive}"><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='fa fa-user text--danger'></i> Account Details</span></a>
                </div>
            </div>`
const reviewerNavbar = `   <div style="display: flex;" class="dash-nav">
                    <a href="${parentDirectoryName}/dashboard/authordash" class="${homeActive}"><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='las la-home text--danger'></i>Home </span></a>
                    <a href="${parentDirectoryName}/dashboard/authordash/manuscripts" class="${authorActive}" ><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='las la-pen text--danger'></i> Author </span></a>
                    <a href="${parentDirectoryName}/dashboard/reviewerdash" class="${reviewerActive}" ><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='las la-bell text--danger'></i> Review </span></a>
                     <a href="${parentDirectoryName}/dashboard/mail/inbox" class="${inboxActive}"><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='fa fa-envelope text--danger'></i> Inbox</span></a>
                 <a href="${parentDirectoryName}/portal/settings" class="${inboxActive}"><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='fa fa-user text--danger'></i> Settings</span></a>
                </div>
            </div>`
const editorNavbar = `   <div style="display: flex;" class="dash-nav">
                    <a href="${parentDirectoryName}/dashboard/authordash" class="nav-active"><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='las la-home text--danger'></i>Home </span></a>
                    <a href="${parentDirectoryName}/dashboard/authordash/manuscripts" ><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='las la-pen text--danger'></i> Author </span></a>
                    <a href="${parentDirectoryName}/dashboard/reviewerdash" ><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='las la-bell text--danger'></i> Review </span></a>
                    <a href="${editorsDomainEndpoint}?e=${email}" target=_blank><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='las la-edit text--danger'></i> Editorial Assignments </span></a>
                     <a href="${parentDirectoryName}/dashboard/mail/inbox" class="${inboxActive}"><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='fa fa-envelope text--danger'></i> Inbox</span></a>
                      <a href="${parentDirectoryName}/portal/settings" class="${inboxActive}"><span class=" fw-bold" style="margin-left: 20px; margin-right: 20px;"> <i class='fa fa-user text--danger'></i> Settings</span></a>
                </div>
            </div>`

const isAuthor = userInfo.account_status 
const is_reviewer = userInfo.is_reviewer 
const is_editor = userInfo.is_editor
const userfullname = `${userInfo.prefix} ${userInfo.firstname} ${userInfo.lastname} ${userInfo.othername}`

const userfullname_container = document.querySelectorAll(".user_fullnameContainer")
userfullname_container.forEach(container =>{
    container.innerText = userfullname
})

if(isAuthor === "verified" && is_reviewer != "yes" && is_editor != "yes"){
    navbarContainer.innerHTML = authorNavbar
}else if(isAuthor === "verified" && is_reviewer === "yes" && is_editor != "yes"){
    navbarContainer.innerHTML = reviewerNavbar
}else if(isAuthor === "verified" && is_editor === "yes"){
navbarContainer.innerHTML = editorNavbar
}else{
    console.log(isAuthor)
}


// Check if the person is a reviewer and allow them into the reviewers page 
if(reviewerdashPattern.test(url.pathname) && isAuthor === "verified" && is_reviewer === "yes"){

}
// }else{
//     window.location.href = '/'
// }