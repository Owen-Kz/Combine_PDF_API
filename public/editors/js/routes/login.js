const hoursToKeep = 1;  // Desired duration in hours
const daysToKeep = hoursToKeep / 24;  // Convert hours to days
const expirationDays = daysToKeep > 0 ? daysToKeep : 1;  // Ensure a minimum of 1 day

 


const  SetCookies = function setCookie(name, value, daysToExpire) {
    const date = new Date();
    date.setTime(date.getTime() + (daysToExpire * 24 * 60 * 60 * 1000));
    const expires = 'expires=' + date.toUTCString();
    document.cookie = name + '=' + value + '; ' + expires + '; path=/';
}
const LoginForm = document.getElementById("login-form")
 

if(LoginForm){

    LoginForm.addEventListener("submit", function(e){
        e.preventDefault();
        const formData = {
            email: email.value,
            pass: password.value
        }

        fetch(`/editors/editorsLogin`, {
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
                    iziToast.success({
            title: `Success`,
            message: `Logged In Successfully`,
            position: 'topCenter'
        });
                window.location.reload()
                // window.location.href = `${parentDirectoryName}/dashboard`
            }else{
            iziToast.error({
            title: `Error`,
            message: `${data.message}`,
            position: 'topCenter'
        });
                
            }
        }else{
            // console.error("No data")
                iziToast.error({
            title: `Error`,
            message: `Internal Server Error!`,
            position: 'topCenter'
        });
        }
        })
    
    })
}
