// Function to show the popup
function showProgressSavedPopup() {
    const popup = document.getElementById('progressSavedPopup');
    popup.classList.remove('hidden');
    popup.classList.add('show', 'slide-in');

    // Hide the popup after 3 seconds (adjust as needed)
    setTimeout(() => {
        popup.classList.remove('show');
        popup.classList.add('hidden');
    }, 3000); // 3000 milliseconds = 3 seconds
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