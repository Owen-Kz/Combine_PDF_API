import { submissionsEndpoint } from "../constants.js"



async function getAuthor(email){
  return  fetch(`${submissionsEndpoint}/authorsProfileForSearch?encrypted=${email}`)
    .then(res=>res.json())
    .then(data=>{
        if(data){
            
            if(data.accountData){
              
                const authorDataArray = data.accountData
                const fullname = `${authorDataArray.prefix} ${authorDataArray.firstname} ${authorDataArray.othername} ${authorDataArray.lastname}`
                return fullname
            }else{
                return encrypted
            }
        }
    })
}


export {
    getAuthor
}