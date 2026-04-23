import { submissionsEndpoint } from "./constants.js";
 
function validateLogin(Id){
  return  fetch(`${submissionsEndpoint}/isEditor`, {
        method:"POST",
        body:JSON.stringify({id:Id}),
        headers:{
            "Content-type" : "application/JSON"
        }
    }).then(res => res.json())
    .then(data=>{
        if(data.success){
            return data.account
        }else{
            console.log(data.error)
            return false
        }
    })
}


export {
    validateLogin
}