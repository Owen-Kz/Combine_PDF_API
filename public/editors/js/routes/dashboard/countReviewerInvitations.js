// import { submissionsEndpoint } from "../constants.js"
// 

async function countAcceptedReviewerInvitations(article_id){
    return fetch(`/editors/countAcceptedReviewerInvitations?a_id=${article_id}`,{})
    .then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.count
            
        }else{
            console.log(data.error)
        }
    })
}

async function CountRejectedReviewerInvitaitons(article_id){
    return fetch(`/editors/countRejectedReviewerInvitations?a_id=${article_id}`,{})
    .then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.count
        }else{
            console.log(data.error)
        }
    })
}

async function CountTotalReviewerInvitaitons(article_id){
    return fetch(`/editors/countTotalReviewerInvitations?a_id=${article_id}`,{})
    .then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.count
        }else{
            console.log(data.error)
        }
    })
}
// export {
//     countAcceptedReviewerInvitations,
//     CountRejectedReviewerInvitaitons,
//     CountTotalReviewerInvitaitons
// }