import { submissionsEndpoint } from "../constants.js"


async function GetKeywords(articleID) {
    return fetch(`${submissionsEndpoint}/getKeywords`,{
        method:"POST",
        body: JSON.stringify({article_id:articleID})

    }).then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.keywords
        }else{
            return []
        }
    })
}

export {
    GetKeywords
}