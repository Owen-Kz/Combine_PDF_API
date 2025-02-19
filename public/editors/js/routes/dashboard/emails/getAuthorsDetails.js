import { submissionsEndpoint } from "../../constants.js"



async function getAuthorsDetails(user, encrypted){
  return  fetch(`${submissionsEndpoint}/authorProfileDetails?&u_id=${user}&encrypted=${encrypted}`)
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
    getAuthorsDetails
}