import { submissionsEndpoint } from "../constants.js";

function GetPreviousAdminSubmissions(id, RevisionId){
 
   return fetch(`${submissionsEndpoint}/allPreviousSubmissions`, {
        method: "POST",
        body:JSON.stringify({admin_id:id, item_id:RevisionId}),
        headers:{
            "Content-type" : "application/JSON"
        }
    }).then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.submissions
        }else{
            console.log(data.error)
            return false
        }

    })
}


export {
    GetPreviousAdminSubmissions
} 