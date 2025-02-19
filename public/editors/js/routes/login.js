import { parentDirectoryName, submissionsEndpoint } from "./constants.js";
import { GetCookie, SetCookies, hoursToKeep } from "./setCookie.js";

const LoginForm = document.getElementById("login-form")
 
// check if the user is logged in 
const editor = GetCookie("editor")

if(LoginForm){

    LoginForm.addEventListener("submit", function(e){
        e.preventDefault();
        const formData = {
            email: email.value,
            pass: password.value
        }

        fetch(`${submissionsEndpoint}/editorsLogin`, {
            method:"POST",
            body: JSON.stringify(formData),
            headers:{
                "Content-type" : "application/JSON"
            }
        }).then(res=>res.json())
        .then(data=>{
            if(data){
            if(data.status === "success"){
                const userId = data.id 
                SetCookies("editor", userId, hoursToKeep);
                window.location.reload()
                // window.location.href = `${parentDirectoryName}/dashboard`
            }else{
                alert(data.message)
            }
        }else{
            console.error("No data")
        }
        })
    
    })
}
