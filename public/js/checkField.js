import { fetchOrcidData } from "./fetchOrcidId.js";
import { getQuillInstance, initializeQuill } from "./quill.js";

// Track current active section globally
let currentActiveSection = null;

// Validation rules for each step
const validationRules = {
  'article-type': validateArticleType,
  'upload-manuscript': validateUploadManuscript,
  'title': validateTitle,
  'abstract': validateAbstract,
  'keywords': validateKeywords,
  'author-information': validateAuthorInformation,
  'suggest-reviewers': validateReviewers,
  'disclosures': validateDisclosures
};

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initializeApplication();
});

function initializeApplication() {
  // Initialize Quill editor
  const quill = getQuillInstance();
  
  // Initialize auto-save functionality
  initializeAutoSave();
  
  // Initialize all button states and event listeners
  initializeButtonStates();
  
  // Initialize step completion from saved data
  initializeStepCompletion();
  
  // Set up navigation observer to detect when user navigates back
  setupNavigationObserver();
}

// Observe URL changes and page visibility to handle back/forward navigation
function setupNavigationObserver() {
  // Handle browser back/forward buttons
  window.addEventListener('popstate', function() {
    setTimeout(initializeButtonStates, 100);
  });
  
  // Handle page visibility changes (when returning to tab)
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      setTimeout(initializeButtonStates, 100);
    }
  });
  
  // Re-initialize when page becomes visible (including from browser navigation)
  if (document.visibilityState === 'visible') {
    setTimeout(initializeButtonStates, 100);
  }
}

// Initialize all button states based on current form data
function initializeButtonStates() {
  const activeSection = document.querySelector('.submit-body section:not([style*="display: none"])');
  if (!activeSection) return;
  
  currentActiveSection = activeSection.id;
  
  switch (activeSection.id) {
    case 'article-type':
      initializeArticleTypeButtons();
      break;
    case 'upload-manuscript':
      initializeUploadButtons();
      break;
    case 'title':
      initializeTitleButtons();
      break;
    case 'abstract':
      initializeAbstractButtons();
      break;
    case 'keywords':
      initializeKeywordsButtons();
      break;
    case 'author-information':
      initializeAuthorButtons();
      break;
    case 'suggest-reviewers':
      initializeReviewerButtons();
      break;
    case 'disclosures':
      initializeDisclosureButtons();
      break;
  }
}

// Auto-save functionality
function initializeAutoSave() {
  if (!window.submissionManager) {
    console.warn('Submission manager not available');
    return;
  }

  // Auto-save on form changes with debouncing
  let saveTimeout;
  document.addEventListener('input', function(e) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const activeSection = document.querySelector('.submit-body section:not([style*="display: none"])');
      if (activeSection) {
        saveCurrentStep(activeSection.id);
        // Re-check button states after save
        initializeButtonStates();
      }
    }, 1000);
  });

  // Auto-save on field blur (immediate)
  document.addEventListener('blur', function(e) {
    if (e.target.matches('input, select, textarea')) {
      const activeSection = document.querySelector('.submit-body section:not([style*="display: none"])');
      if (activeSection) {
        saveCurrentStep(activeSection.id);
        // Re-check button states after save
        initializeButtonStates();
      }
    }
  }, true);
}

// Save current step data
async function saveCurrentStep(stepId) {
  if (!window.submissionManager) return;

  const stepData = getStepData(stepId);
  if (stepData) {
    try {
      await window.submissionManager.saveStep(stepId, stepData);
      updateStepCompletion(stepId, true);
    } catch (error) {
      console.error(`Failed to save ${stepId}:`, error);
    }
  }
}

// Get step data for saving
function getStepData(stepId) {
  const section = document.getElementById(stepId);
  if (!section) return null;

  const form = section.querySelector('form');
  if (!form) return null;

  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  // Special handling for different step types
  switch (stepId) {
    case 'article-type':
      return {
        article_type: data.article_type,
        discipline: data.discipline,
        is_women_in_contemporary_science: data.is_women_in_contemporary_science
      };
    
    case 'title':
      return {
        title: data.title
      };
    
    case 'abstract':
      const quill = getQuillInstance();
      return {
        abstract: quill ? quill.root.innerHTML : data.abstract
      };
    
    case 'keywords':
      const keywordInputs = section.querySelectorAll('input[name="keywords"]');
      const keywords = Array.from(keywordInputs)
        .map(input => input.value.trim())
        .filter(keyword => keyword.length > 0);
      return { keywords };
    
    case 'author-information':
      return getAuthorsData();
    
    case 'suggest-reviewers':
      return getReviewersData();
    
    case 'disclosures':
      return {
        disclosure_confirm: data.disclosure_confirm || 'no'
      };
    
    default:
      return data;
  }
}

// Get authors data
function getAuthorsData() {
  const authorElements = document.querySelectorAll('.author-item');
  const authors = Array.from(authorElements).map(author => ({
    authors_fullname: author.querySelector('[name="authors_fullname"]')?.value || '',
    authors_email: author.querySelector('[name="authors_email"]')?.value || '',
    orcid_id: author.querySelector('[name="orcid_id"]')?.value || '',
    asfi_membership_id: author.querySelector('[name="asfi_membership_id"]')?.value || '',
    affiliations: author.querySelector('[name="affiliations"]')?.value || '',
    affiliation_country: author.querySelector('[name="affiliation_country"]')?.value || '',
    affiliation_city: author.querySelector('[name="affiliation_city"]')?.value || ''
  })).filter(author => author.authors_fullname.trim().length > 0);

  return { authors };
}

// Get reviewers data
function getReviewersData() {
  const reviewerElements = document.querySelectorAll('.reviewer-item');
  const reviewers = Array.from(reviewerElements).map(reviewer => ({
    reviewer_name: reviewer.querySelector('[name="reviewer_name"]')?.value || '',
    reviewer_email: reviewer.querySelector('[name="reviewer_email"]')?.value || '',
    reviewer_affiliation: reviewer.querySelector('[name="reviewer_affiliation"]')?.value || ''
  })).filter(reviewer => reviewer.reviewer_name.trim().length > 0);

  return { reviewers };
}

// Update step completion status in navigation
function updateStepCompletion(stepId, completed = true) {
  const stepNav = document.getElementById(`${stepId}_nav`);
  if (stepNav) {
    const icon = stepNav.querySelector('i');
    if (icon) {
      icon.textContent = completed ? 'check_circle' : 'lock';
      icon.style.color = completed ? '#4CAF50' : '';
    }
    
    // Enable next step
    const nextStep = getNextStep(stepId);
    if (nextStep) {
      const nextNav = document.getElementById(`${nextStep}_nav`);
      if (nextNav) {
        nextNav.classList.remove('disabled');
      }
    }
  }
}

// Get next step
function getNextStep(currentStep) {
  const steps = ['article_type', 'upload_manuscript', 'title', 'abstract', 'keywords', 'author_information', 'suggest_reviewers', 'disclosures', 'review_submit'];
  const currentIndex = steps.indexOf(currentStep);
  return steps[currentIndex + 1];
}

// Initialize step completion from saved data
function initializeStepCompletion() {
  const savedData = window.submissionManager?.loadFromLocalStorage() || {};
  Object.keys(savedData).forEach(step => {
    if (savedData[step] && Object.keys(savedData[step]).length > 0) {
      updateStepCompletion(step, true);
    }
  });
}

// VALIDATION FUNCTIONS
function validateArticleType() {
  const articleTypeSelect = document.getElementById('article_type');
  const disciplineSelect = document.getElementById('discipline');
  const isYesChecked = document.getElementById("is_women_in_contemporary_science_yes")?.checked;
  const isNotChecked = document.getElementById("is_women_in_contemporary_science_no")?.checked;

  return articleTypeSelect?.value !== '' &&
         disciplineSelect?.value !== '' &&
         (isYesChecked || isNotChecked);
}

function validateUploadManuscript() {
  const fileFields = document.querySelectorAll("#upload-manuscript .requiredFiles");
  const allFilesFilled = Array.from(fileFields).every(field => field.value !== "");
  const allFilesValid = Array.from(fileFields).every(field => {
    if (!field.files[0]) return false;
    
    const file = field.files[0];
    const validTypes = [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
      "application/pdf"
    ];
    
    return file.size <= 50000000 && validTypes.includes(file.type);
  });

  return allFilesFilled && allFilesValid;
}

function validateTitle() {
  const titleInputs = document.querySelectorAll("#title input[type=text]");
  return Array.from(titleInputs).every(input => input.value.trim() !== "");
}

function validateAbstract() {
  const quill = getQuillInstance();
  if (!quill) return false;
  
  const text = quill.getText().trim();
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  const charCount = text.length;

  return wordCount > 0 && wordCount <= 300 && charCount <= 3000;
}

function validateKeywords() {
  const keywordInputs = document.querySelectorAll("#keywords input[type=text]");
  return Array.from(keywordInputs).some(input => input.value.trim() !== "");
}

function validateAuthorInformation() {
  const authorElements = document.querySelectorAll('.author-item');
  if (authorElements.length === 0) return false;

  // At least one author must be fully filled
  return Array.from(authorElements).some(author => {
    const fullname = author.querySelector('[name="authors_fullname"]')?.value.trim();
    const email = author.querySelector('[name="authors_email"]')?.value.trim();
    const affiliation = author.querySelector('[name="affiliations"]')?.value.trim();
    
    return fullname && fullname.length > 0 && 
           email && email.length > 0 && 
           affiliation && affiliation.length > 0;
  });
}

function validateReviewers() {
  // Reviewers are optional, so always return true
  return true;
}

function validateDisclosures() {
  const disclosureConfirm = document.querySelector('input[name="disclosure_confirm"]:checked');
  return disclosureConfirm !== null;
}

// Check if current step is valid
function isCurrentStepValid() {
  const activeSection = document.querySelector('.submit-body section:not([style*="display: none"])');
  if (!activeSection) return false;
  
  const validator = validationRules[activeSection.id];
  return validator ? validator() : false;
}

// Show validation errors
function showValidationErrors() {
  const activeSection = document.querySelector('.submit-body section:not([style*="display: none"])');
  if (!activeSection) return;

  // Highlight required fields that are empty
  const requiredFields = activeSection.querySelectorAll('[required]');
  let hasErrors = false;
  
  requiredFields.forEach(field => {
    if (!field.value || field.value.trim() === '') {
      field.style.borderColor = '#ff4444';
      hasErrors = true;
    } else {
      field.style.borderColor = '';
    }
  });

  if (hasErrors) {
    showErrorPopup('Please complete all required fields before proceeding.');
    return;
  }

  // Section-specific validation messages
  switch (activeSection.id) {
    case 'article-type':
      if (!validateArticleType()) {
        showErrorPopup('Please select article type, discipline, and indicate if this is for Women in Contemporary Science.');
      }
      break;
    case 'upload-manuscript':
      if (!validateUploadManuscript()) {
        showErrorPopup('Please upload all required files. Files must be Word documents or PDFs under 50MB.');
      }
      break;
    case 'abstract':
      if (!validateAbstract()) {
        showErrorPopup('Abstract must be between 1-300 words and under 3000 characters.');
      }
      break;
    case 'author-information':
      if (!validateAuthorInformation()) {
        showErrorPopup('Please provide at least one author with full name, email, and affiliation.');
      }
      break;
    case 'disclosures':
      if (!validateDisclosures()) {
        showErrorPopup('Please confirm the disclosure statement before proceeding.');
      }
      break;
  }
}

// Button initialization functions
function initializeArticleTypeButtons() {
  const nextButton = document.querySelector('#article-type .nextManuscript');
  if (!nextButton) return;

  // Remove existing event listeners by cloning and replacing
  const newNextButton = nextButton.cloneNode(true);
  nextButton.parentNode.replaceChild(newNextButton, nextButton);

  function updateButtonState() {
    const isValid = validateArticleType();
    
    if (isValid) {
      newNextButton.classList.remove("disabled");
      newNextButton.disabled = false;
    } else {
      newNextButton.classList.add("disabled");
      newNextButton.disabled = true;
    }
  }

  // Set initial state
  updateButtonState();

  // Add event listeners to all relevant fields
  const articleTypeSelect = document.getElementById('article_type');
  const disciplineSelect = document.getElementById('discipline');
  const womenYes = document.getElementById("is_women_in_contemporary_science_yes");
  const womenNo = document.getElementById("is_women_in_contemporary_science_no");

  [articleTypeSelect, disciplineSelect, womenYes, womenNo].forEach(element => {
    if (element) {
      element.addEventListener('change', function() {
        updateButtonState();
        saveCurrentStep('article-type');
      });
    }
  });

  newNextButton.addEventListener('click', function(e) {
    if (!validateArticleType()) {
      e.preventDefault();
      showValidationErrors();
    }
  });
}

function initializeUploadButtons() {
  const uploadSection = document.getElementById("upload-manuscript");
  const fileFields = uploadSection?.querySelectorAll(".requiredFiles");
  const nextButton = uploadSection?.querySelector(".nextManuscript");
  
  if (!fileFields || !nextButton) return;

  const newNextButton = nextButton.cloneNode(true);
  nextButton.parentNode.replaceChild(newNextButton, nextButton);

  function updateButtonState() {
    const isValid = validateUploadManuscript();
    
    if (isValid) {
      newNextButton.classList.remove("disabled");
      newNextButton.disabled = false;
    } else {
      newNextButton.classList.add("disabled");
      newNextButton.disabled = true;
    }
  }

  // Set initial state
  updateButtonState();

  // Add event listeners
  fileFields.forEach(field => {
    field.addEventListener("change", function() {
      const file = this.files[0];
      if (file) {
        if (file.size > 50000000) {
          showErrorPopup("File size is too large");
          this.value = '';
        } else if (![
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/pdf"
        ].includes(file.type)) {
          showErrorPopup("Invalid file type. Please upload a Word document (.doc, .docx) or a PDF file (.pdf).");
          this.value = '';
        }
      }
      updateButtonState();
      saveCurrentStep('upload-manuscript');
    });
  });

  newNextButton.addEventListener('click', function(e) {
    if (!validateUploadManuscript()) {
      e.preventDefault();
      showValidationErrors();
    }
  });
}

function initializeTitleButtons() {
  const titleSection = document.getElementById("title");
  const titleInputs = titleSection?.querySelectorAll("input[type=text]");
  const nextButton = titleSection?.querySelector(".nextManuscript");
  
  if (!titleInputs || !nextButton) return;

  const newNextButton = nextButton.cloneNode(true);
  nextButton.parentNode.replaceChild(newNextButton, nextButton);

  function updateButtonState() {
    const isValid = validateTitle();
    
    if (isValid) {
      newNextButton.classList.remove("disabled");
      newNextButton.disabled = false;
    } else {
      newNextButton.classList.add("disabled");
      newNextButton.disabled = true;
    }
  }

  updateButtonState();

  titleInputs.forEach(input => {
    input.addEventListener("input", function() {
      updateButtonState();
      saveCurrentStep('title');
    });
  });

  newNextButton.addEventListener('click', function(e) {
    if (!validateTitle()) {
      e.preventDefault();
      showValidationErrors();
    }
  });
}

function initializeAbstractButtons() {
  const abstractSection = document.getElementById("abstract");
  const nextButton = abstractSection?.querySelector(".nextManuscript");
  
  if (!nextButton) return;

  const newNextButton = nextButton.cloneNode(true);
  nextButton.parentNode.replaceChild(newNextButton, nextButton);

  const quill = getQuillInstance();
  if (quill) {
    function updateButtonState() {
      const isValid = validateAbstract();
      
      if (isValid) {
        newNextButton.classList.remove("disabled");
        newNextButton.disabled = false;
      } else {
        newNextButton.classList.add("disabled");
        newNextButton.disabled = true;
      }
    }

    checkAbstractWordCount(quill, newNextButton);
    
    quill.on('text-change', function() {
      checkAbstractWordCount(quill, newNextButton);
      updateButtonState();
      saveCurrentStep('abstract');
    });

    newNextButton.addEventListener('click', function(e) {
      if (!validateAbstract()) {
        e.preventDefault();
        showValidationErrors();
      }
    });
  } else {
    console.error("Quill editor not initialized");
    newNextButton.classList.add("disabled");
    newNextButton.disabled = true;
  }
}

function initializeKeywordsButtons() {
  const keywordsSection = document.getElementById("keywords");
  const keywordInputs = keywordsSection?.querySelectorAll("input[type=text]");
  const nextButton = keywordsSection?.querySelector(".nextManuscript");
  
  if (!keywordInputs || !nextButton) return;

  const newNextButton = nextButton.cloneNode(true);
  nextButton.parentNode.replaceChild(newNextButton, nextButton);

  function updateButtonState() {
    const isValid = validateKeywords();
    
    if (isValid) {
      newNextButton.classList.remove("disabled");
      newNextButton.disabled = false;
    } else {
      newNextButton.classList.add("disabled");
      newNextButton.disabled = true;
    }
  }

  updateButtonState();

  keywordInputs.forEach(input => {
    input.addEventListener("input", function() {
      updateButtonState();
      saveCurrentStep('keywords');
    });
  });

  newNextButton.addEventListener('click', function(e) {
    if (!validateKeywords()) {
      e.preventDefault();
      showValidationErrors();
    }
  });
}

function initializeAuthorButtons() {
  const authorSection = document.getElementById("author-information");
  const nextButton = authorSection?.querySelector(".nextManuscript");
  
  if (!nextButton) return;

  const newNextButton = nextButton.cloneNode(true);
  nextButton.parentNode.replaceChild(newNextButton, nextButton);

  function updateButtonState() {
    const isValid = validateAuthorInformation();
    
    if (isValid) {
      newNextButton.classList.remove("disabled");
      newNextButton.disabled = false;
    } else {
      newNextButton.classList.add("disabled");
      newNextButton.disabled = true;
    }
  }

  // Set initial state
  updateButtonState();

  // Add event listeners to author fields
  const authorInputs = authorSection.querySelectorAll('input[name="authors_fullname"], input[name="authors_email"], input[name="affiliations"]');
  authorInputs.forEach(input => {
    input.addEventListener('input', function() {
      updateButtonState();
      saveCurrentStep('author-information');
    });
  });

  newNextButton.addEventListener('click', function(e) {
    if (!validateAuthorInformation()) {
      e.preventDefault();
      showValidationErrors();
    }
  });
}

function initializeReviewerButtons() {
  const reviewerSection = document.getElementById("suggest-reviewers");
  const nextButton = reviewerSection?.querySelector(".nextManuscript");
  
  if (nextButton) {
    // Reviewers are optional, so button is always enabled
    nextButton.classList.remove("disabled");
    nextButton.disabled = false;
    
    const newNextButton = nextButton.cloneNode(true);
    nextButton.parentNode.replaceChild(newNextButton, nextButton);

    newNextButton.addEventListener('click', function(e) {
      // No validation needed for optional reviewers
      saveCurrentStep('suggest-reviewers');
    });
  }
}

function initializeDisclosureButtons() {
  const disclosureSection = document.getElementById("disclosures");
  const nextButton = disclosureSection?.querySelector(".nextManuscript");
  
  if (!nextButton) return;

  const newNextButton = nextButton.cloneNode(true);
  nextButton.parentNode.replaceChild(newNextButton, nextButton);

  function updateButtonState() {
    const isValid = validateDisclosures();
    
    if (isValid) {
      newNextButton.classList.remove("disabled");
      newNextButton.disabled = false;
    } else {
      newNextButton.classList.add("disabled");
      newNextButton.disabled = true;
    }
  }

  // Set initial state
  updateButtonState();

  // Add event listeners to radio buttons
  const disclosureRadios = disclosureSection.querySelectorAll('input[name="disclosure_confirm"]');
  disclosureRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      updateButtonState();
      saveCurrentStep('disclosures');
    });
  });

  newNextButton.addEventListener('click', function(e) {
    if (!validateDisclosures()) {
      e.preventDefault();
      showValidationErrors();
    }
  });
}

// Abstract word count function (keep your existing implementation)
function checkAbstractWordCount(quill, nextButton) {
  const wordCountElement = document.getElementById('word-count');
  const limitExceed = document.getElementById('limit-exceed');
  
  if (!wordCountElement || !limitExceed) {
    console.error("Word count elements not found");
    return;
  }
  
  const text = quill.getText().trim();
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  const charCount = text.length;

  wordCountElement.textContent = 'Word Count: ' + wordCount + ' words';

  if (wordCount > 300 || charCount > 3000) {
    limitExceed.innerHTML = `<p>Word Limit Exceeded. Please adjust to expected limit before proceeding. Maximum of 300 Words!</p>`;
  } else {
    limitExceed.innerHTML = " ";
    wordCountElement.textContent = 'Word Count: ' + wordCount + ' words';
  }
}

// Find Orcid URLs
function RunOrcidQuery(){
  const OrcidInputFields = document.querySelectorAll('.orcidID')
  OrcidInputFields.forEach(field =>{
    field.addEventListener("change", function(){
      if(field.value !== ""){
        field.value = fetchOrcidData(field.value)
        saveCurrentStep('author-information');
      }
    })
  })
}

// Initialize on load
RunOrcidQuery();

export {
  RunOrcidQuery,
  saveCurrentStep,
  getStepData,
  updateStepCompletion,
  initializeButtonStates,
  isCurrentStepValid,
  showValidationErrors
}