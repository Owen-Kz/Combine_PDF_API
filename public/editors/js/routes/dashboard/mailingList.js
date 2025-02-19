import { submissionsEndpoint } from "../constants.js"
import { formatTimestamp } from "../formatDate.js"
import { GetCookie } from "../setCookie.js"

const MailingListContainer = document.getElementById("mailingListContainer")

const editorid = GetCookie("editor")

const userFullnameContainer = document.querySelectorAll(".userFullnameContainer")
const submissionsContainer = document.getElementById("submissionsContainer")
const authorsCount = document.querySelectorAll(".authorsCount")
const reviewedCount = document.querySelectorAll(".reviewedCount")

const SubmissionsCount = document.querySelectorAll(".submissionsCount")
const user = GetCookie("editor")
if(user){

fetch(`${submissionsEndpoint}/email/getEmailSubscribers?a_id=${editorid}`)
.then(res=>res.json())
.then(data =>{
    if(data.success){
        const MailingList = data.emailList
        MailingList.forEach(subscriber => {
            MailingListContainer.innerHTML += `     <tr>
                                            <td>
                                               ${subscriber.id}
                                            </td>
                                            <td>
                                                <p>${subscriber.email}</p>
                                                
                                            </td>
                                          <td>
                                              <p>${formatTimestamp(subscriber.date_joined)}</p>
                                          </td>
                                        </tr>`
        });
    }else{
        MailingListContainer.innerHTML = `<tr><td>${data.error}</td></tr>`

    }
   
                            
})
}else{

    window.location.href = `${parentDirectoryName}/workflow/accounts/login`
}