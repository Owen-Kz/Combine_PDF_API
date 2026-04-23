import { submissionsEndpoint } from "../constants.js"

async  function GetAttachments(emailID){
    return fetch(`${submissionsEndpoint}/email/getAttachments?e=${emailID}`)
    .then(res =>res.json())
    .then(data =>{
        if(data.status === "success"){
            return data.attachments
        }else{
            return []
        }
    })
}
export {
    GetAttachments
}