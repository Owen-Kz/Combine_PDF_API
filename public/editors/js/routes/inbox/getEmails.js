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



                // Render the email body. The stored body may be Quill Delta JSON
                // (older records) or already-formatted HTML (newer records), so
                // try to parse JSON first and fall back to rendering HTML directly.
                function renderEmailBody(rawBody) {
                    let parsed = null;
                    try {
                        parsed = JSON.parse(rawBody);
                    } catch (e) {
                        // Not JSON - body is already HTML or plain text
                        parsed = null;
                    }

                    const isDelta = Array.isArray(parsed) || (parsed && Array.isArray(parsed.ops));
                    if (isDelta) {
                        const deltaContent = Array.isArray(parsed) ? parsed : parsed.ops;

                        // Create a Quill instance in "read-only" mode to render the content as HTML
                        const tempDiv = document.createElement('div');
                        const quill = new Quill(tempDiv, {
                            theme: 'snow',
                            modules: { toolbar: false },
                            readOnly: true,
                        });

                        quill.setContents(deltaContent);
                        contentDiv.innerHTML += tempDiv.innerHTML;
                        return;
                    }

                    if (parsed && (parsed.compiledLetter || parsed.message)) {
                        renderEmailBody(parsed.compiledLetter || parsed.message);
                        return;
                    }

                    // Already HTML (or plain text) - inject directly
                    contentDiv.innerHTML += rawBody || '';
                }

                renderEmailBody(data.emails.body);

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