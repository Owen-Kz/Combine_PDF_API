import { GetParameters, processEndpoint, submissionsEndpoint } from "../constants.js";
import { formatTimestamp } from "../formatDate.js";
import { GetCookie } from "../setCookie.js";
import { GetAttachments } from "./getAttachments.js";
import { GetBCCEmails } from "./getBCCEmails.js";
import { GetCCEmails } from "./getCCEmails.js";
const user = GetCookie("editor")
const contentDiv = document.getElementById('email-content');

// Get the Email Containent 
async function GetEmailContent(emailID) {
    const BCCEMails = await GetBCCEmails(emailID);
    const CCEmails = await GetCCEmails(emailID);
    const Attachments = await GetAttachments(emailID)


    fetch(`${submissionsEndpoint}/emailContent?u_id=${user}&emailId=${emailID}`, {})
        .then(res => res.json())
        .then(data => {
            if (data.emails) {
                contentDiv.innerHTML = `<div>
                <p><b>${data.emails.subject}</b></p> 
                <p>${data.emails.article_id}</p>
                <p>To: ${data.emails.recipient}</p>
                <p>${formatTimestamp(data.emails.date_sent)}</p>
                </div>
                
                `
                if (CCEmails.length > 0) {
                    contentDiv.innerHTML += `<p><b>CC:</b></p>`

                    for (let i = 0; i < CCEmails.length; i++) {
                        contentDiv.innerHTML += `<span>${CCEmails[i].cc_email}</span>, `
                    }
                }

                if (BCCEMails.length > 0) {
                    contentDiv.innerHTML += "<p><b>BCC</b></p>"
                    for (let i = 0; i < BCCEMails.length; i++) {
                        contentDiv.innerHTML += `<span class="other_emails">${BCCEMails[i].bcc_email}</span>, `
                    }
                }

                contentDiv.innerHTML += `<hr/>`



                // Parse the Quill content from the JSON data]
                const quillContent = JSON.parse(data.emails.body);

                // Create a Quill instance in "read-only" mode to render the content as HTML
                function renderQuillAsHTML(divId, deltaContent) {
                    // Create a Quill instance in a temporary div
                    const tempDiv = document.createElement('div');
                    const quill = new Quill(tempDiv, {
                        theme: 'snow',
                        modules: { toolbar: false },
                        readOnly: true,
                    });

                    // Set the content as Quill Delta and extract the HTML
                    quill.setContents(deltaContent);

                    // Get the innerHTML from the Quill editor
                    const htmlContent = tempDiv.innerHTML;

                    // Render the extracted HTML into the specified div
                    contentDiv.innerHTML += htmlContent;
                }

                // Render the Quill content as HTML in the "content" div
                renderQuillAsHTML('content', quillContent);

                if (Attachments.length > 0) {
                    contentDiv.innerHTML += `<hr/>`
                    contentDiv.innerHTML += `<p><b>Attachments</b></p>`

                    const attchmentList = document.createElement("ul")
                    attchmentList.setAttribute("style", "list-style-type:disc;")
                    for (let i = 0; i < Attachments.length; i++) {
                        attchmentList.innerHTML += `<li><a href="${processEndpoint}/item?url=${Attachments[i].file_path}" target=_blank>${Attachments[i].file_name}</a></li>`
                    }
                    contentDiv.appendChild(attchmentList)
                }



            } else {
                contentDiv.innerHTML = `   <div id="email1" class="email-details">
                      <h4>Oops, Could Not Retrieve Email at this time</h4>
                      <p>Please try again...</p>
                    </div>`
            }
        })
}

export {
    GetEmailContent
}