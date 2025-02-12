
const FilesArray = [];

function removeFile(fieldName, fieldContainerId, label){
    const fileContainer = document.getElementById(fieldContainerId)
    fileContainer.setAttribute("style", "color:black;")

    // Remove file from FilesArray
    const index = FilesArray.findIndex(fileObject => fileObject.fieldName === fieldName);
    if (index > -1) {
        FilesArray.splice(index, 1);
    }
 
  fileContainer.innerHTML = ` <label for="${fieldName}">${label}:</label>
                          <input type="file" class="form-control" name="${fieldName}">`  
}

function navigateSection(sectionId) {
    var currentSection = document.querySelector('.form-section:not(.hidden)');
    var nextSection = document.getElementById(sectionId);

    if (currentSection && nextSection && !nextSection.classList.contains('hidden')) {
        currentSection.classList.add('hidden');
        nextSection.classList.remove('hidden');
        nextSection.classList.add('fade-in');

        updateNavigationList(sectionId);
    }
}

function updateNavigationList(currentSectionId, Nextitem) {

   const item = document.getElementById(currentSectionId)
   const next = document.getElementById(Nextitem);
    item.setAttribute("class", "active-nav")
    next.removeAttribute("class")

    const Lock = item.querySelector("i")
    const LockNext = next.querySelector("i")
    LockNext.innerText = "lock_open"

    Lock.innerHTML = "<span></span>";
}

function NavigationNext(nextSection, navItemId, Nextitem 
    ,  headerMessageIndex){
    const OttherSections = document.querySelectorAll(".form-section")
    OttherSections.forEach(Section => {
        Section.classList.add('hidden');
        // const buttons = document.getElementById(prevSection);
        if(Section){
            Section.querySelector(".submit-next").style.display="none";
        }
    })
    document.getElementById(nextSection).classList.remove('hidden');
    document.getElementById(nextSection).classList.add('fade-in');
    document.getElementById(nextSection).querySelector(".submit-next").style.display="block";

    updateNavigationList(navItemId, Nextitem)
 
    scrollTo(0, 0);  // Scroll to the top of the page if needed
            // HEader messages 
            const headerMessageContainer = document.getElementById("headerMessage")
        headerMessageContainer.innerHTML = headerMessages[headerMessageIndex]

}

// Function to show the popup
function showErrorPopup(message) {
    const errorpopup = document.getElementById('errorPopup');
    errorpopup.innerHTML = `<p>${message}</p>`
    errorpopup.classList.remove('hidden');
    errorpopup.classList.add('show', 'slide-in');

    // Hide the popup after 3 seconds (adjust as needed)
    setTimeout(() => {
        errorpopup.classList.remove('show');
        errorpopup.classList.add('hidden');
    }, 8000); // 8000 milliseconds = 8 seconds
}



function setStatus(status){
    const reviewStatus  = document.querySelector('input[name="review_status"]')
    // const submitForm = document.querySelector("#submitForm")

    reviewStatus.value = status
    // submitForm.click()

    submitSection("submitDisclosure")
}

function showNext(nextSection, currentSection, navItemId, Nextitem, prevSection, headerMessageIndex, submitButton) {
    document.getElementById(currentSection).classList.add('hidden');
    document.getElementById(nextSection).classList.remove('hidden');
    document.getElementById(nextSection).classList.add('fade-in');
    updateNavigationList(navItemId, Nextitem)
    document.getElementById(nextSection).querySelector(".submit-next").style.display="block";

    // setStatus('saved_for_later');
    const buttons = document.getElementById(prevSection);
    if(buttons){
        buttons.querySelector(".submit-next").style.display="none";
    }
    

    
    scrollTo(0, 0);  // Scroll to the top of the page if needed
            // HEader messages 
            const headerMessageContainer = document.getElementById("headerMessage")
        headerMessageContainer.innerHTML = headerMessages[headerMessageIndex]


}





function submitSection(submitButton){
    const submitButtonMain = document.getElementById(submitButton)
    if(submitButtonMain){
        submitButtonMain.removeAttribute("disabled")
    submitButtonMain.click()

    }else{
        console.log(submitButton, " not found")
    }
}

function getCookie(name) {
    let cookies = document.cookie.split("; ");
    for (let cookie of cookies) {
        let [key, value] = cookie.split("=");
        if (key === name) return decodeURIComponent(value);
    }
    return null;
}
