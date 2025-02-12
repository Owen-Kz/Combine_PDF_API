// import { EndPoint, submissionsEndpoint } from "../constants.js";
// import { GetAccountData } from "../dashboards/accountData.js";
// import { GetCookie } from "../setCookie.js";
// import { quill } from "./quill.js";

// const uploadForm = document.getElementById("uploadForm");
const body = document.querySelector("body")
const message_container = document.getElementById("message_container")
// const user = GetCookie("user")
const UserData = {affiliation:"sgoiso", affiliation_city:"sgoiso", affiliation_country:"sgoiso", email:"aet", firstname:"aet", lastname:"aet", orcid_id:"aet", othername:"aet", prefix:"aet"}
const disciplineContainer = document.getElementById("disciplineContainer")
const email = UserData.email 
const discipline = document.querySelector('#discipline')
discipline.addEventListener("change", function(){
    
    if(discipline.value == "other" || discipline.value == "Other"){
       
        discipline.removeAttribute("name")
        disciplineContainer.innerHTML = `<input class='form-control' name="discipline" placeholder="Specify Your discipline" required/>`
    }else{
        if(discipline.hasAttribute("name")){

        }else{
            discipline.setAttribute("name", "discipline")
        }
        disciplineContainer.innerHTML = ""
    }
})
const emailContainer = document.getElementById("loggedIn_email")
const loggedContainer = document.getElementById("logged_email")

const prefix = document.getElementById("author_information_prefix")
const firstname = document.getElementById("loggedIn_firstname")
const lastname  = document.getElementById("loggedIn_lastname")
const othername = document.getElementById("loggedIn_othername")
const orcid = document.getElementById("loggedIn_orcid")
const affiliation = document.getElementById("loggedIn_affiliation")
const affiliationCountry = document.getElementById("loggedIn_affiliation_country")
const affiliationCity = document.getElementById("loggedIn_affiliation_city")

firstname.value = UserData.firstname
prefix.value = UserData.prefix
lastname.value = UserData.lastname 
othername.value = UserData.othername
orcid.value = UserData.orcid_id
affiliation.value = UserData.affiliations
affiliationCountry.value = UserData.affiliation_country
affiliationCity.value = UserData.affiliation_city 
emailContainer.value = email 
loggedContainer.value = email

body.setAttribute("id", "formNotSubmitted")
// Function to show the popup
function showProgressSavedPopup() {
    const popup = document.getElementById('progressSavedPopup');
    popup.classList.remove('hidden');
    popup.classList.add('show', 'slide-in');

    // Hide the popup after 3 seconds (adjust as needed)
    setTimeout(() => {
        popup.classList.remove('show');
        popup.classList.add('hidden');
    }, 3000); // 3000 milliseconds = 3 seconds
}

// Function to show the popup
function showErrorPopup(message) {
    const errorpopup = document.getElementById('errorPopup');
    errorpopup.innerHTML = `<p>${message}</p>`
    errorpopup.classList.remove('hidden');
    errorpopup.classList.add('show', 'slide-in');

    // Hide the popup after 3 seconds (adjust as needed)
    setTimeout(() => {
        errorpopup.classList.remove('show');
        errorpopup.classList.add('hidden');
    }, 8000); // 8000 milliseconds = 8 seconds
}


// uploadForm.addEventListener("submit", function(e) {
//     e.preventDefault();
   
//     const formData = new FormData(uploadForm);
//     formData.append('abstract', JSON.stringify(quill.getContents().ops));


// const SubmissionSTatus = document.querySelector('input[name="review_status"]')
// if(SubmissionSTatus.value === "submitted"){
//     body.removeAttribute("id")
// }else{
//     console.log("formSubmitted")
//     body.setAttribute("id", "formNotSubmitted")
// }
//     fetch(`${submissionsEndpoint}/submit/`, {
//         method: 'POST',
//         body: formData
//     })
//     .then(response => response.json())
//     .then(data => {
//         if(data.status === "success"){
//             if(SubmissionSTatus.value === "submitted"){
//             alert("Manuscript Submitted Successfully")
//             window.location.href = "/dashboard/authordash/manuscripts"
//             }else[
//                 showProgressSavedPopup()
//             ]
//         }else if(data.status === "error"){
//             showErrorPopup(data.message)
//             body.setAttribute("id", "formNotSubmitted")
//             if(data.message === "A submission already exists with this title"){
//                 NavigationNext('title', 'title_nav', 'abstract_nav', 2)
//             }
//         }else{
//             alert(data)
//             console.log(data)
//             showErrorPopup("Internal Server Error")
//             body.setAttribute("id", "formNotSubmitted")
//         }

//     })
//     .catch(error => {
//         alert(error)
//         body.setAttribute("id", "formNotSubmitted")
//         console.error('Error:', error);
//     });
// });

