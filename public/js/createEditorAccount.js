import { GetParameters, parentDirectoryName, submissionsEndpoint } from "../constants.js"
import { CheckeditorExists } from "./checkeditorExists.js"
const EmailQuery = GetParameters(window.location.href).get("e")

if(EmailQuery){
// Check if the account Exists
const Accountexists = await CheckeditorExists(EmailQuery)

if(Accountexists){
    window.location.href = `${parentDirectoryName}/portal/login`
}else{
const prefix  = document.getElementById("prefix")
const registerForm = document.getElementById("registerForm")
const firstname = document.getElementById("first_name")
const lastname = document.getElementById("last_name")
const othername = document.getElementById("other_name")
const email = document.getElementById("email");
const affiliation = document.getElementById("affiliation")
const affiliation_country = document.getElementById("affiliation_country")
const affiliation_city = document.getElementById("affiliation_city")
const password = document.getElementById("password")
const disciplineMain = document.querySelector(".discipline")
const discipline = document.querySelector('#discipline')
const orcid = document.getElementById("orcid");

email.value = EmailQuery
email.setAttribute("readonly", true)
if(discipline){
discipline.addEventListener("change", function(){
    if(discipline.value == "other" || discipline.value == "Other"){
        discipline.removeAttribute("name")
        disciplineContainer.innerHTML = `<input class='form-control discipline' name="discipline" placeholder="Specify Your discipline" required/>`
    }else{
        if(discipline.hasAttribute("name")){

        }else{
            discipline.setAttribute("name", "discipline")
        }
        disciplineContainer.innerHTML = ""
    }
})
}
const password2 = document.getElementById("password2")

const message_container = document.getElementById("message_container")
const body = document.querySelector("body")
body.setAttribute("id", "formNotSubmitted")
password.addEventListener("keyup", function(){
    if(!password.value){
        message_container.innerHTML =`<div class="alert-danger">Password Can not be empty</div>`
    }else if(password.value != password2.value){
        message_container.innerHTML =`<div class="alert-danger">Passwords do not match</div>`
    }else{
        message_container.innerHTML = ``
    }
})
password2.addEventListener("keyup", function(){
    if(!password.value){
        message_container.innerHTML =`<div class="alert-danger">Password Can not be empty</div>`
    }else if(password.value != password2.value){
        message_container.innerHTML =`<div class="alert-danger">Passwords do not match</div>`
    }else{
        message_container.innerHTML = ``
    }
})

registerForm.addEventListener("submit", function(e){
    e.preventDefault();

    if(!password.value){
        message_container.innerHTML =`<div class="alert-danger">Password Can not be empty</div>`
    }else if(password.value != password2.value){
        message_container.innerHTML =`<div class="alert-danger">Passwords do not match</div>`
    }else if(password.value && password.value == password2.value && email.value){
        const formData = {
            prefix:prefix.value,
            firstname:firstname.value,
            lastname:lastname.value,
            othername: othername.value,
            orcid:orcid.value,
            discipline:disciplineMain.value,
            email: email.value,
            affiliations: affiliation.value,
            affiliations_country: affiliation_country.value,
            affiliations_city:affiliation_city.value,
            password: password.value,
        }
body.removeAttribute("id")


        fetch(`${submissionsEndpoint}/backend/editors/createeditorAccount.php`, {
            method:"POST",
            body:JSON.stringify(formData),
            headers:{
                "Content-type" : "application/JSON"
            }
        }).then(res=>res.json())
        .then(data=>{
            if(data){
            if(data.status === "error"){
                message_container.innerHTML =`<div class="alert-danger">${data.message}</div>`
                alert(data.message)
                body.setAttribute("id", "formNotSubmitted")

            }else if(data.status === "success"){
                message_container.innerHTML =`<div class="alert-success">${data.message}</div>`
                window.location.href = "/portal/login"
body.setAttribute("id", "formNotSubmitted")
                
            }else{
                console.log(data.message)
body.setAttribute("id", "formNotSubmitted")

            }
        }else{
            message_container.innerHTML =`<div class="alert-danger">Internal Server Error</div>`
        
        }
        })

    }
    
})
}
}