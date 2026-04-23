// Add this at the top of your file with other constants
const SEARCH_DELAY_MS = 500; // Half-second delay before searching
const MIN_SEARCH_LENGTH = 2; // Minimum characters before searching

// Add this near your other variable declarations
let searchTimeout;
let currentSearchQuery = '';

// Replace your existing search function with this:
function initializeSearch() {
    const searchInput = document.querySelector('.search');
    if (!searchInput) return;

    searchInput.addEventListener('input', function() {
        const value = this.value.trim();
        currentSearchQuery = value;
        
        // Clear previous timeout
        clearTimeout(searchTimeout);
        
        // Show loading indicator for searches
        if (value.length >= MIN_SEARCH_LENGTH) {
            submissionsContainer.innerHTML = '<tr><td colspan="6">Searching...</td></tr>';
            
            // Delay the search to avoid spamming the server
            searchTimeout = setTimeout(() => {
                loadSubmissions(1, value); // Reset to page 1 when searching
            }, SEARCH_DELAY_MS);
        } else if (value.length === 0) {
            // If search is cleared, load normal submissions
            currentSearchQuery = '';
            loadSubmissions(1);
        }
    });
}




    initializeSearch();


// // Initialize the search when the page loads
// if (user) {
//     initializeSearch();
//     loadSubmissions(currentPage);
// }