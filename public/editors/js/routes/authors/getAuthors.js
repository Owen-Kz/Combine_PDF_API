import { GetParameters, parentDirectoryName, submissionsEndpoint } from "../constants.js"
import { formatTimestamp } from "../formatDate.js"
import { GetCookie } from "../setCookie.js"
import { validateLogin } from "../validateLogin.js"

const userFullnameContainer = document.querySelectorAll(".userFullnameContainer")
const AuthorsContainer = document.getElementById("AuthorsContainer")
const view = GetParameters(window.location.href).get("view")
const user = GetCookie("editor")
if(user){
const AccountData = await validateLogin(user)


const userFullname = AccountData.fullname 
const email = AccountData.email 
const accoount_type = AccountData.editorial_level

userFullnameContainer.forEach(container =>{
    container.innerText= userFullname
})

let SubmisisonsArray = []
let Authorstatus = ""
let adminAction = ""
let tableRowClass = ""
let AuthorsEmail = ""

if(accoount_type === "editor_in_chief" || accoount_type === "editorial_assistant"){
    fetch(`${submissionsEndpoint}/authorsList?u_id=${user}`, {

    }).then(res=>res.json())
    .then(data=>{
        if(data){
            const MainAuthorsList = data.authorsList;
            const newAuthorsArray = [];
            
            const findAnAuthor = document.getElementById("findAnAuthor");
            const AuthorsContainer = document.getElementById("AuthorsContainer"); // Assuming you have this element
            
            function updateUI(AuthorsList) {
                AuthorsContainer.innerHTML = ''; // Clear previous content
                if (AuthorsList.length > 0) {
                    AuthorsList.forEach(author => {
                        const AccountStatus = author.account_status;
                        let StatusColor = "";
            
                        if (AccountStatus === 'verified') {
                            StatusColor = "status-green";
                        } else {
                            StatusColor = "status-orange";
                        }
            
                        AuthorsContainer.innerHTML += `       
                            <tr>
                                <td>${author.prefix}</td>
                                <td><p>${author.firstname} ${author.othername}</p></td>
                                <td><p>${author.lastname}</p></td>
                                <td>
                                    <p>${author.affiliations}</p> 
                                    <p>${author.affiliation_city}, ${author.affiliation_country}</p>                                                   
                                </td>
                                <td><p>${formatTimestamp(author.date_joined)}</p></td>
                                <td class="status">
                                    <span class="status-text ${StatusColor}">${AccountStatus}</span>
                                </td>
                                <td>
                                    <form class="form" id="${author.email}">
                                        <select name="view" class="action-box">
                                            <option>Actions</option>
                                            <option value="${author.email}">View Profile</option>
                                        </select>
                                    </form>
                                </td>
                            </tr> 
                        `;
                    });
            
                    var actionBoxMain = document.querySelectorAll('.action-box');
    
                    actionBoxMain.forEach(actionBox =>{

                    actionBox.addEventListener('change', (event) => {
                        const id = event.target.closest("form").id
                        
                        // const action = event.target.value;
                    window.location.href = `${parentDirectoryName}/Profile?e=${id}`
            
                    })
                })
                } else {
                    AuthorsContainer.innerHTML = `<tr><td>No result to display.</td></tr>`;
                }

            }
            
            findAnAuthor.addEventListener("keyup", function () {
                const searchTerm = findAnAuthor.value.toLowerCase();
                const filteredAuthors = MainAuthorsList.filter(author => {
                    return (
                        author.email.toLowerCase().includes(searchTerm) ||
                        author.firstname.toLowerCase().includes(searchTerm) ||
                        author.lastname.toLowerCase().includes(searchTerm)
                    );
                });
                updateUI(filteredAuthors);
            });
            
            updateUI(MainAuthorsList);
            
        }
    
    })
    // if(view && view != ""){
    // }


}
}else{
    window.location.href = `${parentDirectoryName}/dashboard`
}
