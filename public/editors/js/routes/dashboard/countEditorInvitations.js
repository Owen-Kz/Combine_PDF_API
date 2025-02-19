import { submissionsEndpoint } from "../constants.js"

async function countAcceptedEditorInvitations(article_id){
    return fetch(`${submissionsEndpoint}/countAcceptedEditorInvitations?a_id=${article_id}`,{})
    .then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.count
            
        }else{
            console.log(data.error)
        }
    })
}

async function CountRejectedEditorInvitaitons(article_id){
    return fetch(`${submissionsEndpoint}/countRejectedEditorInvitations?a_id=${article_id}`,{})
    .then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.count
        }else{
            console.log(data.error)
        }
    })
}

async function CountTotalEditorInvitaitons(article_id){
    return fetch(`${submissionsEndpoint}/countTotalEditorInvitations?a_id=${article_id}`,{})
    .then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.count
        }else{
            console.log(data.error)
        }
    })
}
export {
    countAcceptedEditorInvitations,
    CountRejectedEditorInvitaitons,
    CountTotalEditorInvitaitons
}