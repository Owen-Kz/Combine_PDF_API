
const prefix  = document.getElementById("prefix")
const registerForm = document.getElementById("registerForm")
const firstname = document.getElementById("first_name")
const lastname = document.getElementById("last_name")
const othername = document.getElementById("other_name")
const asfi_membership_id = document.getElementById("asfi_membership_id")
const email = document.getElementById("email");
const affiliation = document.getElementById("affiliation")
const affiliation_country = document.getElementById("affiliation_country")
const affiliation_city = document.getElementById("affiliation_city")
const password = document.getElementById("password")
const disciplineMain = document.querySelector(".discipline")
const discipline = document.querySelector('#discipline')
const orcid = document.getElementById("orcid");

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
            asfi_membership_id: asfi_membership_id.value
        }
body.removeAttribute("id")


        fetch(`/backend/reviewers/createReviewerAccount`, {
            method:"POST",
            body:JSON.stringify(formData),
            headers:{
                "Content-type" : "application/JSON"
            }
        }).then(res=>res.json())
        .then(data=>{
            if(data){
            if(data.error){
                message_container.innerHTML =`<div class="alert-danger">${data.error}</div>`
                alert(data.error)
                body.setAttribute("id", "formNotSubmitted")

            }else if(data.success){
                message_container.innerHTML =`<div class="alert-success">${data.success}</div>`
                window.location.href = "https://asfirj.org/portal/login"
body.setAttribute("id", "formNotSubmitted")
                
            }else{
                console.log(data)
body.setAttribute("id", "formNotSubmitted")

            }
        }else{
            message_container.innerHTML =`<div class="alert-danger">Internal Server Error</div>`
        
        }
        })

    }
    
})
