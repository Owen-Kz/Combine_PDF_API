import { GetParameters, parentDirectoryName, submissionsEndpoint } from "../constants.js";
import { GetSubmissionData } from "../queries/getSubmissionData.js";
import { formatTimestamp } from "../formatDate.js"
import { GetCookie } from "../setCookie.js"
import { validateLogin } from "../validateLogin.js"
import { GetKeywords } from "../queries/getKeywords.js";
import { getAuthor } from "./getAuthor.js";

const userFullnameContainer = document.querySelectorAll(".userFullnameContainer")
const user = GetCookie("editor")
if (user) {
    const AccountData = await validateLogin(user)

    const userFullname = AccountData.fullname
    const email = AccountData.email
    const accoount_type = AccountData.editorial_level
 
    userFullnameContainer.forEach(container => {
        container.innerText = userFullname
    })
    const ArticleId = GetParameters(window.location.href).get("a")
    const ArticlesContainer = document.getElementById("articlesContainer")

    if (ArticleId) {
        const ArticleData = await GetSubmissionData(ArticleId)

        if (ArticleData) {
            let AuthorsList = ""
            const unstructuredAbstract = ArticleData.abstract
            let documentFile = ""
            let DOCUMENTFILE = ""
            let MANUSCRIPT_FILE = ""
            
            // Helper function to generate filename
            const generateFilename = (articleTitle, fileType, fileUrl) => {
                // Clean the article title for filename use
                const cleanTitle = articleTitle
                    .replace(/[^a-z0-9]/gi, '_')
                    .toLowerCase()
                    .substring(0, 50); // Limit length
                
                // Get file extension from URL
                let extension = '.file';
                if (fileUrl) {
                    const urlExtension = fileUrl.split('.').pop();
                    if (urlExtension && urlExtension.length <= 5) {
                        extension = '.' + urlExtension.toLowerCase();
                    }
                }
                
                return `${cleanTitle}_${fileType}`;
            };

            if (ArticleData.date_submitted < "2025-01-07") {
                MANUSCRIPT_FILE = `<li>Manuscript File: <a href="https://test.asfirj.org/uploadedFiles/${ArticleData.manuscript_file}">${ArticleData.manuscript_file}</a></li>`

                if (ArticleData.document_file !== "dummy.pdf") {
                    documentFile = ArticleData.document_file;
                    DOCUMENTFILE = `<li>Document File: <a href="https://test.asfirj.org/uploadedFiles/${documentFile}">${documentFile}</a></li>`;
                }
            } else {
                if(ArticleData.manuscript_file && ArticleData.manuscript_file !== null){
                    if (ArticleData.manuscript_file.slice(0, 26) === 'https://res.cloudinary.com') {
                        const filename = generateFilename(ArticleData.title, 'manuscript', ArticleData.manuscript_file);
                        MANUSCRIPT_FILE = `<li>Manuscript File: <a href="/doc?download=true&id=${ArticleData.revision_id}&url=${ArticleData.manuscript_file}&filename=${encodeURIComponent(filename)}">Download Manuscript</a></li>`
                    } else {
                        MANUSCRIPT_FILE = `<li>Manuscript File: <a href="https://test.asfirj.org/uploadedFiles/${ArticleData.manuscript_file}">${ArticleData.manuscript_file}</a></li>`
                    }
                } else {
                    MANUSCRIPT_FILE = "<li>No Manuscript has been submitted</li>"
                }

                // Process additional files
                const filesArrayCont = []
                const fileTypes = []
                
                // Add files with their types
                if (ArticleData.supplementary_material) {
                    filesArrayCont.push(ArticleData.supplementary_material);
                    fileTypes.push('supplementary_material');
                }
                if (ArticleData.graphic_abstract) {
                    filesArrayCont.push(ArticleData.graphic_abstract);
                    fileTypes.push('graphic_abstract');
                }
                if (ArticleData.figures) {
                    filesArrayCont.push(ArticleData.figures);
                    fileTypes.push('figures');
                }
                if (ArticleData.tables) {
                    filesArrayCont.push(ArticleData.tables);
                    fileTypes.push('tables');
                }
                if (ArticleData.tracked_manuscript_file) {
                    filesArrayCont.push(ArticleData.tracked_manuscript_file);
                    fileTypes.push('tracked_manuscript');
                }

                DOCUMENTFILE = "<b>Additional Document Files</b> (i.e supplementary materials, tables, figures, graphic abstract): ";
                
                for (let i = 0; i < filesArrayCont.length; i++) {
                    const fileUrl = filesArrayCont[i];
                    const fileType = fileTypes[i];
                    
                    if (fileUrl.slice(0, 26) === 'https://res.cloudinary.com') {
                        const filename = generateFilename(ArticleData.title, fileType, fileUrl);
                        const displayName = fileType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        DOCUMENTFILE += `<br> <a href="/doc?download=true&id=${ArticleData.revision_id}&url=${fileUrl}&filename=${encodeURIComponent(filename)}" style="color:#333; text-decoration: underline;" target=_blank>Download ${displayName}</a>`;
                    } else {
                        DOCUMENTFILE += `<br> <a href="https://test.asfirj.org/uploadedFiles/${fileUrl}" style="color:#333; text-decoration: underline;" target=_blank>View ${fileUrl}</a>`;
                    }
                }
            }
            
            let coverLetterMan = ""
            if(ArticleData.cover_letter_file && ArticleData.cover_letter_file.slice(0, 26) === 'https://res.cloudinary.com'){
                const filename = generateFilename(ArticleData.title, 'cover_letter', ArticleData.cover_letter_file);
                coverLetterMan = `<a href="/doc?download=true&id=${ArticleData.revision_id}&url=${ArticleData.cover_letter_file}&filename=${encodeURIComponent(filename)}">Download Cover Letter</a></li>`;
            } else if (ArticleData.cover_letter_file) {
                coverLetterMan = `<a href="https://test.asfirj.org/uploadedFiles/${ArticleData.cover_letter_file}">${ArticleData.cover_letter_file}</a></li>`;
            } else {
                coverLetterMan = "<span>No cover letter submitted</span></li>";
            }

            ArticlesContainer.innerHTML = `     <!-- Section  -->
                                        <div class="d-md-flex mb-3" style="flex-direction: column;">
                                        <h3 class="box-title mb-0">Title</h3>
                                        <div>${ArticleData.title}</div>
                                    </div>
                                    <!-- End Section  -->
                                                       <!-- Section  -->
                                    <div class="d-md-flex mb-3" style="flex-direction: column;">
                                        <h3 class="box-title mb-0">Discipline</h3>
                                       <div>${ArticleData.discipline}</div>
                                    </div>
                                    <!-- End Section  -->
                                                 <!-- Section  -->
                                    <div class="d-md-flex mb-3" style="flex-direction: column;">
                                        <h3 class="box-title mb-0">Article Type</h3>
                                       <div>${ArticleData.article_type}</div>
                                    </div>
                                    <!-- End Section  -->
                                        <!-- End Section  -->
                                                 <!-- Section  -->
                                    <div class="d-md-flex mb-3" style="flex-direction: column;">
                                        <h3 class="box-title mb-0">Corresponding Author</h3>
                                        <div><b>${await getAuthor(ArticleData.corresponding_authors_email)}</b></div>
                                       <div>${ArticleData.corresponding_authors_email}</div>
                                       
                                    </div>
                                    <!-- End Section  --> 
                                     
                                    <!-- Section  -->
                                    <div class="d-md-flex mb-3" style="flex-direction: column;">
                                        <h3 class="box-title mb-0">Abstract</h3>
                                        <div id="content" class="ql-editor"></div> 
                                    </div>
                                    <!-- End Section  -->
                                    <!-- Section  -->
                                    <div class="d-md-flex mb-3 row">
                                        <h3 class="box-title mb-0">Files</h3>
                                       <ul style="list-style-type:disc;">
                                        <li>Cover Letter: ${coverLetterMan}
                                        ${MANUSCRIPT_FILE}
                                        ${DOCUMENTFILE} 

                                       </ul>
                                       <a href='/combine?a=${ArticleData.revision_id}'><button type="button" class="combine_file">Combine Files</button></a>
                                       <p> Please note that this only applies to papers submitted before 2025</p>
                                    </div>
                                    
                                    <!-- End Section  -->
                                        <!-- Section  -->
                                    <div class="d-md-flex mb-3 row">
                                        <h3 class="box-title mb-0">Authors</h3>
                                    
                                       <table class="projects-table">
                                            <thead>
                                                <tr>
                                                    <th>Name</th> 
                                                    <th>ORCID-ID</th> 
                                                    <th>Affiliation</th> 
                                                    <th>Afffiliation City</th> 
                                                    <th>Afffiliation Country</th> 
                                                    <th>Email</th> 
                                                    <th>ASFI Membership ID</th> 
                                                </tr>

                                            </thead>
                                            <tbody id="authorsContainer">

                                        
                  
                                        </tbody>
                                       
                                        </table>
                                    
                                    </div>

                                    <div class="d-md-flex mb-3">
                                        <h3 class="box-title mb-0">Keywords</h3>
                                        
                                    <ul>
                                        <li>
                                       <p id="keywordsContainer">
                                    
                                       </p>
                                       </li>
                                    </ul>
                                    
                                    </div>

                                     <div class="form-section hidden" id="disclosures">


                        <h3 class="manu_head">Disclosures</h3><br>

                        <!-- Main toolbar -->
                       <ul style="color: #e22424; list-style-type: disc;">
                          <li style="color: black; margin-bottom: 10px;">I confirm that the manuscript has been submitted solely to ASFIRJ and is not published, in press,
                            or submitted elsewhere, with exception of submission to preprint servers.</li>
                       <li style="color: black; margin-bottom: 10px;">I am aware that ASFIRJ requires that all authors disclose all potential sources of conflict of interest in regarding the submitted manuscript and I confirm that all authors have done so.
                     </li>
                     <li style="color: black; margin-bottom: 10px;">I am aware that ASFIRJ requires that all authors disclose all potential sources of conflict of interest in regarding the submitted manuscript and I confirm that all authors have done so.
                     </li>
                      <li style="color: black; margin-bottom: 10px;">I confirm that the research that yielded the manuscript being submitted meets the ethical guidelines and adheres to all legal research requirements of the study country.
                     </li>
                     <li style="color: black; margin-bottom: 10px;">I have prepared my manuscript and files, including text, tables, and figures, in accordance with ASFIRJ's style and formatting requirements as described at: <a href="https://asfirj.org/authors.html" style="color: 2cabe3;">asfirj.org/authors.html</a>.</li>
                     <li style="color: black; margin-bottom: 10px;">I confirm that each of the co-authors acknowledges their participation in the research that yielded
                            the manuscript being submitted and agrees to the submission of the manuscript to ASFIRJ.</li>
                       <li style="color: black; margin-bottom: 10px;">I confirm that the contributions each author made to the manuscript are specified in the authors' contribution section of the manuscript.</li> 
                       
                    <li style="color: black; margin-bottom: 10px;">I confirm that the manuscript being submitted and the data it contains are unpublished and original.</li>
                       
                <li style="color: black; margin-bottom: 10px;">I confirm that I am willing to pay ASFIRJ's APC for the submitted manuscript if it is accepted for publication in the journal as indicated at <a href="https://asfirj.org/aboutus.html" style="color:2cabe3;">asfirj.org/aboutus.html</a>.</li>
                    </ul>


                                    <!-- End Section  -->
                              `;

            // Parse the Quill content from the JSON data
            const quillContent = JSON.parse(unstructuredAbstract);

            // Create a Quill instance in "read-only" mode to render the content as HTML
            const contentDiv = document.getElementById('content');

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
                contentDiv.innerHTML = htmlContent;
            }

            // Render the Quill content as HTML in the "content" div
            renderQuillAsHTML('content', quillContent);
            const AuthorsContainer = document.getElementById("authorsContainer")
            fetch(`${submissionsEndpoint}/getAuthors?articleID=${ArticleId}`, {
                method: "GET"
            }).then(res => res.json())
                .then(data => {

                    if (data) {
                        const AllAuthors = data.authorsList
                        AllAuthors.forEach(author => {
                            AuthorsContainer.innerHTML += `<tr>
                            <td>${author.authors_fullname}</td>
                            <td>${author.orcid_id}</td>
                            <td>${author.affiliations}</td>
                            <td>${author.affiliation_city}</td>
                            <td>${author.affiliation_country}</td>
                            <td><a href="mailto:${author.authors_email}">${author.authors_email}</a></td>
                            <td>${author.asfi_membership_id}</td>
                            </tr>`;
                        });

                    } else {
                        console.log("Server Error")
                    }


                })
        }
    }

    const keywordsContainer = document.getElementById("keywordsContainer");
    const keywords = await GetKeywords(ArticleId)
    for (let i = 0; i < keywords.length; i++) {
        if (i === (keywords.length - 1)) {
            keywordsContainer.innerHTML += `${keywords[i].keyword}`
        } else {
            keywordsContainer.innerHTML += `${keywords[i].keyword}, `
        }
    }

    const suggestedReviewersContainer = document.getElementById("suggestedReviewersContainer")

    fetch(`${submissionsEndpoint}/getSuggestedReviewers?articleID=${ArticleId}`, {
        method: "GET"
    }).then(res => res.json())
        .then(data => {
            if (data) {
                const ReviewersList = data.suggestedReviewers

                ReviewersList.forEach(reviewer => {
                    suggestedReviewersContainer.innerHTML += `
                        <tr>
                           <td><p><b>${reviewer.fullname}</b></p>
                           <p>${reviewer.email}</p>
                           </td>
                                    
                           <td>${reviewer.affiliation}</td>   
                           <td>${reviewer.affiliation_country}</td>
                           <td>${reviewer.affiliation_city}</td>    
                       </tr>
                       `
                })


            } else {
                console.log("Could not Get Suggested Reviewers")
            }
        })


} else {
    window.location.href = `${parentDirectoryName}/workflow/accounts/login`
}