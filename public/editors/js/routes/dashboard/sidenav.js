import { GetCookie } from "../setCookie.js";
import { validateLogin } from "../validateLogin.js";

const admin_nav = `<ul id="sidebarnav">
                        <!-- User Profile-->
                        <li class="sidebar-item pt-2">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="/editors/dashboard/"
                                aria-expanded="false">
                                <i class="far fa-clock" aria-hidden="true"></i>
                                <span class="hide-menu">Dashboard</span>
                            </a>
                        </li>
                        <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="/editors/Authors/"
                                aria-expanded="false">
                                <i class="bi bi-person" aria-hidden="true"></i>
                                <span class="hide-menu">Authors</span>
                            </a>
                        </li>
                        <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="/editors/Inbox/"
                                aria-expanded="false">
                                <!-- <i class="fas fa-hands" aria-hidden="true"></i> -->
                                <i class="fas fa-envelope"></i>
                                <span class="hide-menu">Inbox</span>
                            </a>
                        </li>
                              <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="/editors/Mail/"
                                aria-expanded="false">
                                <!-- <i class="fas fa-hands" aria-hidden="true"></i> -->
                                <i class="fas fa-envelope"></i>
                                <span class="hide-menu">News Letter</span>
                            </a>
                        </li>
                           <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="/editors/EditorInvitations/"
                                aria-expanded="false">
                                <!-- <i class="fas fa-hands" aria-hidden="true"></i> -->
                                <i class="bi bi-person-plus"></i>
                                <span class="hide-menu">Editor Invitations</span>
                            </a>
                        </li>
                            <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="https://asfirj.org/dashboard/"
                                aria-expanded="false" target=_blank>
                                <i class="bi bi-person" aria-hidden="true"></i>
                                <span class="hide-menu">Author's Dashboard</span>
                            </a>
                        </li>
                           <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="/editors/ArchivedPapers"
                                aria-expanded="false">
                                <i class="fas fa-calendar-alt" aria-hidden="true"></i>
                                <span class="hide-menu">Archived Papers</span>
                            </a>
                        </li>
                           <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="/editors/AcceptedPapers"
                                aria-expanded="false">
                                <i class="fas fa-calendar-alt" aria-hidden="true"></i>
                                <span class="hide-menu">Descisioned</span>
                            </a>
                        </li>
                        <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="https://asfirj.org/manuscriptPortal/manage" target="_blank"
                                aria-expanded="false">
                                <i class="fas fa-calendar-alt" aria-hidden="true"></i>
                                <span class="hide-menu">Manage Supplements</span>
                            </a>
                        </li>
                       <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="https://asfirj.org/manuscriptPortal/manageIssues" target="_blank"
                                aria-expanded="false">
                                <i class="fas fa-calendar-alt" aria-hidden="true"></i>
                                <span class="hide-menu">Manage Issues</span>
                            </a>
                        </li>

                           <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="https://asfirj.org/Publish/" target="_blank"
                                aria-expanded="false">
                                <i class="fas fa-book" aria-hidden="true"></i>
                                <span class="hide-menu">Publish</span>
                            </a>
                        </li>
                         <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="https://asfirj.org/manageEditors.html" target="_blank"
                                aria-expanded="false">
                                <i class="bi bi-person-gear" aria-hidden="true"></i>
                                <span class="hide-menu">Manage Editors</span>
                            </a>
                        </li>
                             <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="https://asfirj.org/portal/addEditor/" target="_blank"
                                aria-expanded="false">
                                <i class="bi bi-person-plus" aria-hidden="true"></i>
                                <span class="hide-menu">Add Editor</span>
                            </a>
                        </li>
                        
                        <li class="text-center p-20 upgrade-btn">
                            <a href="/editors/logout/"
                                class="btn d-grid btn-danger text-white">
                                Logout</a>
                        </li>
                    </ul> `
const editor_nav = `<ul id="sidebarnav">
                        <!-- User Profile-->
                        <li class="sidebar-item pt-2">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="/editors/dashboard/"
                                aria-expanded="false">
                                <i class="far fa-clock" aria-hidden="true"></i>
                                <span class="hide-menu">Dashboard</span>
                            </a>
                        </li>
                        <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="/editors/Inbox/"
                                aria-expanded="false">
                                <!-- <i class="fas fa-hands" aria-hidden="true"></i> -->
                                <i class="fas fa-envelope"></i>
                                <span class="hide-menu">Inbox</span>
                            </a>
                        </li>
                               <li class="sidebar-item">
                            <a class="sidebar-link waves-effect waves-dark sidebar-link" href="https://asfirj.org/dashboard/"
                                aria-expanded="false" target=_blank>
                                <i class="bi bi-person" aria-hidden="true"></i>
                                <span class="hide-menu">Author's Dashboard</span>
                            </a>
                        </li>
                        <li class="text-center p-20 upgrade-btn">
                            <a href="/editors/logout/"
                                class="btn d-grid btn-danger text-white">
                                Logout</a>
                        </li>
                    </ul> `;

const user = GetCookie("editor")
if(user){
const AccountData = await validateLogin(user)
const navbar_container = document.getElementById("sidebar_nav")


const userFullname = AccountData.fullname 
const email = AccountData.email 
const accoount_type = AccountData.editorial_level

if(accoount_type === "editor_in_chief" || accoount_type === "editorial_assistant"){
   navbar_container.innerHTML = admin_nav;
}else if(accoount_type === 'sectional_editor' || accoount_type === "associate_editor"){
    navbar_container.innerHTML = editor_nav;
}
}