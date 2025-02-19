import { submissionsEndpoint } from "../constants.js";

function getAcceptedSubmissions(id, page){
   return fetch(`${submissionsEndpoint}/allAcceptedSubmissions?page=${page}`, {
        method: "POST",
        body:JSON.stringify({admin_id:id}),
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
    getAcceptedSubmissions
} 