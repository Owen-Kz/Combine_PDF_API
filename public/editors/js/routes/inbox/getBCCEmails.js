import { submissionsEndpoint } from "../constants.js"

async  function GetBCCEmails(emailID){
    return fetch(`${submissionsEndpoint}/email/getBCC?e=${emailID}`)
    .then(res =>res.json())
    .then(data =>{
        if(data.status === "success"){
            return data.bcc
        }else{
            return []
        }
    })
}
export {
    GetBCCEmails
}