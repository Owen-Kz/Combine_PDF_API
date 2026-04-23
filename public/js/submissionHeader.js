const FilesArray = [];

// NEW: Save current step to localStorage
function saveCurrentStepToStorage(stepData) {
    try {
        localStorage.setItem('currentSubmissionStep', JSON.stringify(stepData));
    } catch (error) {
        console.error('Failed to save step to storage:', error);
    }
}

// NEW: Load current step from localStorage
function loadCurrentStepFromStorage() {
    try {
        const savedStep = localStorage.getItem('currentSubmissionStep');
        return savedStep ? JSON.parse(savedStep) : null;
    } catch (error) {
        console.error('Failed to load step from storage:', error);
        return null;
    }
}

// NEW: Clear saved step (call when submission is complete)
function clearSavedStep() {
    try {
        localStorage.removeItem('currentSubmissionStep');
    } catch (error) {
        console.error('Failed to clear saved step:', error);
    }
}

// NEW: Navigate to saved step on page load
function navigateToSavedStep() {
    const savedStep = loadCurrentStepFromStorage();
    if (savedStep && savedStep.currentSection) {
        // Hide all sections first
        const allSections = document.querySelectorAll('.form-section');
        allSections.forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show the saved section
        const savedSection = document.getElementById(savedStep.currentSection);
        if (savedSection) {
            savedSection.classList.remove('hidden');
            savedSection.classList.add('fade-in');
            
            // Update navigation
            if (savedStep.navItemId) {
                const navItem = document.getElementById(savedStep.navItemId);
                if (navItem) {
                    navItem.classList.add('active-nav');
                }
            }
            
            // Update header message
            if (savedStep.headerMessageIndex !== undefined && headerMessages[savedStep.headerMessageIndex]) {
                const headerMessageContainer = document.getElementById("headerMessage");
                headerMessageContainer.innerHTML = headerMessages[savedStep.headerMessageIndex];
            }
            
            // Reinitialize button states
            setTimeout(() => {
                if (typeof initializeButtonStates === 'function') {
                    initializeButtonStates();
                }
            }, 100);
            
            console.log('Restored saved step:', savedStep.currentSection);
        }
    }
}

// Initialize saved step navigation when page loads
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(navigateToSavedStep, 50);
});

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

function NavigationNext(nextSection, navItemId, Nextitem, headerMessageIndex){
    const OttherSections = document.querySelectorAll(".form-section")
    OttherSections.forEach(Section => {
        Section.classList.add('hidden');
        if(Section){
            Section.querySelector(".submit-next").style.display="none";
        }
    })
    document.getElementById(nextSection).classList.remove('hidden');
    document.getElementById(nextSection).classList.add('fade-in');
    document.getElementById(nextSection).querySelector(".submit-next").style.display="block";

    updateNavigationList(navItemId, Nextitem)
 
    scrollTo(0, 0);
    
    // Header messages 
    const headerMessageContainer = document.getElementById("headerMessage")
    headerMessageContainer.innerHTML = headerMessages[headerMessageIndex]

    // NEW: Save current step to localStorage
    saveCurrentStepToStorage({
        currentSection: nextSection,
        navItemId: navItemId,
        headerMessageIndex: headerMessageIndex,
        timestamp: new Date().toISOString()
    });

    // Reinitialize button states after navigation
    setTimeout(() => {
        if (typeof initializeButtonStates === 'function') {
            initializeButtonStates();
        } else {
            // Fallback button state logic
            const activeSection = document.querySelector('.form-section:not(.hidden)');
            if (activeSection) {
                const continueButtons = activeSection.querySelectorAll('.nextManuscript, .submit-next');
                continueButtons.forEach(button => {
                    if (!button.disabled && button.textContent.includes('Continue')) {
                        return;
                    }
                    
                    const sectionId = activeSection.id;
                    let shouldEnable = false;
                    
                    switch(sectionId) {
                        case 'article-type':
                            const articleType = document.getElementById('article_type');
                            const discipline = document.getElementById('discipline');
                            const womenYes = document.getElementById("is_women_in_contemporary_science_yes");
                            const womenNo = document.getElementById("is_women_in_contemporary_science_no");
                            shouldEnable = articleType && articleType.value && 
                                         discipline && discipline.value && 
                                         (womenYes?.checked || womenNo?.checked);
                            break;
                            
                        case 'title':
                            const titleInput = activeSection.querySelector('input[name="manuscript_full_title"]');
                            shouldEnable = titleInput && titleInput.value.trim() !== '';
                            break;
                            
                        case 'upload-manuscript':
                            shouldEnable = false;
                            break;
                            
                        case 'abstract':
                            const quill = typeof getQuillInstance === 'function' ? getQuillInstance() : null;
                            if (quill) {
                                const text = quill.getText().trim();
                                const words = text.split(/\s+/).filter(word => word.length > 0);
                                shouldEnable = words.length > 0 && words.length <= 300;
                            }
                            break;
                            
                        case 'keywords':
                            const keywordInputs = activeSection.querySelectorAll('input[name="keywords"]');
                            shouldEnable = Array.from(keywordInputs).some(input => input.value.trim() !== "");
                            break;
                            
                        case 'author-information':
                            const authorItems = activeSection.querySelectorAll('.author-item');
                            shouldEnable = Array.from(authorItems).some(author => {
                                const fullname = author.querySelector('[name="authors_fullname"]')?.value.trim();
                                const email = author.querySelector('[name="authors_email"]')?.value.trim();
                                return fullname && fullname.length > 0 && email && email.length > 0;
                            });
                            break;
                            
                        case 'suggest-reviewers':
                            shouldEnable = true;
                            break;
                            
                        case 'disclosures':
                            const checkboxes = activeSection.querySelectorAll('.disclosure-checkbox');
                            shouldEnable = Array.from(checkboxes).every(checkbox => checkbox.checked);
                            break;
                            
                        default:
                            shouldEnable = true;
                    }
                    
                    if (shouldEnable) {
                        button.disabled = false;
                        button.classList.remove('disabled');
                    }
                });
            }
        }
    }, 100);
}

function showErrorPopup(message) {
    const errorpopup = document.getElementById('errorPopup');
    errorpopup.innerHTML = `<p>${message}</p>`
    errorpopup.classList.remove('hidden');
    errorpopup.classList.add('show', 'slide-in');

    setTimeout(() => {
        errorpopup.classList.remove('show');
        errorpopup.classList.add('hidden');
    }, 8000);
}

function setStatus(status){
    const reviewStatus  = document.querySelector('input[name="review_status"]')
    reviewStatus.value = status
    submitSection("submitDisclosure")
    
    // NEW: Clear saved step when submission is complete
    if (status === 'submitted') {
        clearSavedStep();
    }
}

function showNext(nextSection, currentSection, navItemId, Nextitem, prevSection, headerMessageIndex, submitButton) {
    document.getElementById(currentSection).classList.add('hidden');
    document.getElementById(nextSection).classList.remove('hidden');
    document.getElementById(nextSection).classList.add('fade-in');
    updateNavigationList(navItemId, Nextitem)
    document.getElementById(nextSection).querySelector(".submit-next").style.display="block";

    const buttons = document.getElementById(prevSection);
    if(buttons){
        buttons.querySelector(".submit-next").style.display="none";
    }
    
    scrollTo(0, 0);
    
    const headerMessageContainer = document.getElementById("headerMessage")
    headerMessageContainer.innerHTML = headerMessages[headerMessageIndex]

    // NEW: Save current step to localStorage
    saveCurrentStepToStorage({
        currentSection: nextSection,
        navItemId: navItemId,
        headerMessageIndex: headerMessageIndex,
        timestamp: new Date().toISOString()
    });

    setTimeout(() => {
        if (typeof initializeButtonStates === 'function') {
            initializeButtonStates();
        }
    }, 100);
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

// NEW: Also save step when user manually saves for later
function saveForLater() {
    const currentSection = document.querySelector('.form-section:not(.hidden)');
    if (currentSection) {
        // Find the current navigation and header info
        const activeNav = document.querySelector('.active-nav');
        const headerMessageContainer = document.getElementById("headerMessage");
        let headerMessageIndex = 0;
        
        // Find which header message is currently displayed
        if (headerMessageContainer) {
            const currentMessage = headerMessageContainer.innerHTML;
            for (let i = 0; i < headerMessages.length; i++) {
                if (headerMessages[i] === currentMessage) {
                    headerMessageIndex = i;
                    break;
                }
            }
        }
        
        saveCurrentStepToStorage({
            currentSection: currentSection.id,
            navItemId: activeNav ? activeNav.id : null,
            headerMessageIndex: headerMessageIndex,
            timestamp: new Date().toISOString(),
            savedForLater: true
        });
        
        showProgressSavedPopup();
    }
}