import { parentDirectoryName } from "./constants.js";


const FooterContainer = document.getElementById("footerContainer")


const FooterContents = ` <div class="foot-head">
    <div class="logo">

        <a href="${parentDirectoryName}/index.html"><img src="${parentDirectoryName}/images/logo.png" alt=""></a>
    </div>

   
</div>

<div class="foot-body">
    <div class="foot-author">
        <h4>AUTHOR</h4>
        <ul>
          <li>
            <a href="${parentDirectoryName}/submitManuscriptSignIn.html">Submit Manuscript</a>
          </li>
          <li>
            <a href="">Print Request</a>
          </li>
        </ul>
    </div>
    <div class="foot-editor">
        <h4>EDITOR</h4>
        <ul>
          <li>
            <a href="${parentDirectoryName}/editors.html">Editors</a>
          </li>
        </ul>
    </div>
    <div class="foot-about">
        <h4>ABOUT</h4>
        <ul>
          <li>
            <a href="${parentDirectoryName}/about.html">About Us</a>
          </li>
          <li>
            <a href="https://africansciencefrontiers.com/">Africa Science Frontiers Initiatives</a>
          </li>
          <li>
            <a href="">Support Center</a>
          </li>
          <li>
            <a href="">Terms of use</a>
          </li>
          <li>
            <a href="${parentDirectoryName}/contact.html">Contact</a>
          </li>
        </ul>
    </div>

</div>
<div class="foot-useful-links">
    <h4>USEFUL LINKS</h4>
    <a href="https://africansciencefrontiers.com/">ASFI</a>
    <a href="https://asfischolar.org">ASFIScholar</a>
</div>

<div class="foot-base" id="base">
    <p>(c) ASFI Research Journal <span id="current-year"></span></p>
</div>`


FooterContainer.innerHTML = FooterContents

document.addEventListener("DOMContentLoaded", function() {
    // Get the current year
    const currentYear = new Date().getUTCFullYear();
    
    // Set the current year in the footer
    const yearSpan = document.getElementById('current-year');
    yearSpan.textContent = currentYear;
});