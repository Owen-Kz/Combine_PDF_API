import { submissionsEndpoint } from "../constants.js";

function GetSubmissionData(id){
  return  fetch(`${submissionsEndpoint}/getSubmissionData`, {
        method:"POST",
        body:JSON.stringify({id:id}),
        headers:{
            "Content-type" : "application/JSON"
        }
    }).then(res=>res.json())
    .then(data=>{
        if(data){
            return data.articles
        }else{
            console.log("Could Not Get Data") 
            return false
        }
    })
}


export {
    GetSubmissionData
}