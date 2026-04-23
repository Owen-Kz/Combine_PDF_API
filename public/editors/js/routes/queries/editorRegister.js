const registerForm = document.getElementById("registerForm")

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

document.getElementById("showPassword").addEventListener("click", function () {
    let passwordField = document.getElementById("password");
    let icon = this.querySelector("i");
    
    if (passwordField.type === "password") {
        passwordField.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        passwordField.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
});

// Show loading animation on form submission
const loadingOverlay = document.createElement("div");
loadingOverlay.id = "loadingOverlay";
loadingOverlay.style.position = "fixed";
loadingOverlay.style.top = "0";
loadingOverlay.style.left = "0";
loadingOverlay.style.width = "100%";
loadingOverlay.style.height = "100%";
loadingOverlay.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
loadingOverlay.style.display = "flex";
loadingOverlay.style.alignItems = "center";
loadingOverlay.style.justifyContent = "center";
loadingOverlay.style.fontSize = "1.5em";
loadingOverlay.style.fontWeight = "bold";
loadingOverlay.innerHTML = "Loading...";
document.body.appendChild(loadingOverlay);
loadingOverlay.style.display = "none";

registerForm.addEventListener("submit", function(e){
    e.preventDefault();
    loadingOverlay.style.display = "flex";
    
    const data = {
        prefix: prefix.value,
        firstname: firstname.value,
        lastname: lastname.value,
        othername: othername.value,
        token: token.value,
        email: email.value,
        editorial_level: editorial_level.value,
        password: password.value,
        affiliation: affiliation.value, 
        affiliation_country: affiliation_country.value,
        affiliation_city: affiliation_city.value,
        orcid_id: orcid_id.value,
        discipline: disciplineMain.value
    };
    
    fetch(`/editors/createAccount`, {
        method: "POST",
        headers: {
            "Content-type" : "application/JSON"
        },
        body: JSON.stringify(data)
    }).then(res => res.json())
    .then(data =>{
        loadingOverlay.style.display = "none";
        if(data.success){
            alert(data.success);
            window.location.href = "/editors/dashboard";
        }else{
            alert(data.error);
        }
    }).catch(error =>{
        loadingOverlay.style.display = "none";
        alert("Something went wrong");
        console.error(error);
    });
});
