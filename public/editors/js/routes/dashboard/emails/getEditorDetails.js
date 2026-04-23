import { submissionsEndpoint } from "../../constants.js"



async function getEditorsDetails(user){
  return  fetch(`${submissionsEndpoint}/editorProfileDetails?&u_id=${user}`)
    .then(res=>res.json())
    .then(data=>{
        if(data){
            
            if(data.accountData){
                const EditorDataArray = data.accountData
                // const fullname = `${EditorDataArray.prefix} ${EditorDataArray.firstname} ${EditorDataArray.othername} ${EditorDataArray.lastname}`
                return EditorDataArray
            }else{
                return null
            }
        }
    })
}


export {
    getEditorsDetails
}