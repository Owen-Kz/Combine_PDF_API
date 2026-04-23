// Get the current URL pathname
const pathname = window.location.pathname;

// Split the pathname by slashes to get the individual segments
const segments = pathname.split('/');

// Get the parent directory name (second to last segment)
// const parentDirectoryName = segments[segments.length - 1];

const parentDIRName = segments[1];
const domainName = window.location.origin
let parentDirectoryName, EndPoint, submissionsEndpoint, domainN, processEndpoint
if(parentDIRName === "asfirj_admin"){   
    parentDirectoryName = `/editors`
    EndPoint = `/asfirj_admin/backend`;
    submissionsEndpoint = '/editors'
    domainN = "http://localhost:3100"
    processEndpoint = "http://localhost:31000"
}else{
    parentDirectoryName = "/editors"
    EndPoint = '/backend'   
    submissionsEndpoint = '/editors'
    domainN = "https://process.asfirj.org"
    processEndpoint = "https://process.asfirj.org"
}

function GetParameters(href){
    // Get the URL string
    const urlString = href;
    
    // Create a URL object
    const url = new URL(urlString);
    
    // Get the search parameters from the URL
    const searchParams = new URLSearchParams(url.search);
    return searchParams
    
    }

// console.log(parentDirectoryName)
// Concatenate with the desired directory name


// Get the URL string
const urlString = window.location.href;

// Create a URL object
const url = new URL(urlString);

// Get the search parameters from the URL
const searchParams = new URLSearchParams(url.search);

// Get the value of the "man" parameter


export { 
    EndPoint,
    parentDirectoryName, 
    domainName,
    searchParams,
    GetParameters,
    submissionsEndpoint,
    url,
    domainN,
    processEndpoint
};
 