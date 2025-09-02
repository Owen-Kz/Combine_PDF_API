

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

async function CountRejectedReviewerInvitations(article_id){
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

async function CountTotalReviewerInvitations(article_id){
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


export {
    countAcceptedReviewerInvitations,
    CountRejectedReviewerInvitations,
    CountTotalReviewerInvitations
}