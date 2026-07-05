const { config } = require("../../../routes/dbPromise.config");

// Retry utility function with exponential backoff
const fetchWithRetry = async (url, options, maxRetries = 3, initialDelay = 1000) => {
    let lastError;
    let delay = initialDelay;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempt ${attempt}/${maxRetries} for: ${url}`);
            
            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // If we got a response, return it regardless of status
            console.log(`Attempt ${attempt} succeeded with status: ${response.status}`);
            return response;
            
        } catch (error) {
            lastError = error;
            console.log(`Attempt ${attempt} failed: ${error.message}`);
            
            // Don't retry if we've exhausted attempts
            if (attempt === maxRetries) {
                console.log(`All ${maxRetries} attempts failed for: ${url}`);
                break;
            }
            
            // Don't retry on certain errors (like 4xx client errors)
            if (error.status && error.status >= 400 && error.status < 500) {
                console.log(`Client error ${error.status}, not retrying`);
                break;
            }
            
            // Exponential backoff with jitter
            const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15
            const waitTime = delay * jitter;
            console.log(`Waiting ${Math.round(waitTime)}ms before retry ${attempt + 1}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            delay *= 2; // Double the delay for next attempt
        }
    }
    
    throw lastError || new Error(`Failed after ${maxRetries} attempts`);
};

const fetchCitations = async (req, res) => {
    try {
        const openCitationsToken = process.env.OPEN_CITATIONS_TOKEN;
        const { doi_number } = req.body;
        
        console.log('Raw DOI input:', doi_number);

        // Validate DOI input
        if (!doi_number) {
            console.log("DOI number is missing in the request body");
            return res.status(400).json({
                success: false,
                message: "DOI number is required"
            });
        }

        // Comprehensive DOI cleaning function
        const cleanDoi = (doi) => {
            let cleaned = doi
                // Remove whitespace
                .trim()
                // Remove common prefixes
                .replace(/^(doi:|doi\.org\/|https?:\/\/doi\.org\/|https?:\/\/dx\.doi\.org\/|http:\/\/dx\.doi\.org\/)/i, '')
                // Remove any trailing slashes
                .replace(/\/$/, '')
                // Remove query parameters
                .replace(/\?.*$/, '')
                // Ensure lowercase
                .toLowerCase();
            
            // Ensure it starts with 10. (standard DOI format)
            if (!cleaned.startsWith('10.')) {
                // Try to extract DOI from various formats
                const doiMatch = cleaned.match(/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i);
                if (doiMatch) {
                    cleaned = doiMatch[1];
                }
            }
            
            return cleaned;
        };

        const cleanDoiNumber = cleanDoi(doi_number);
        console.log('Cleaned DOI:', cleanDoiNumber);

        // Validate DOI format (basic check)
        if (!cleanDoiNumber || !cleanDoiNumber.startsWith('10.')) {
            console.log('Invalid DOI format after cleaning:', cleanDoiNumber);
            return res.status(400).json({
                success: false,
                message: "Invalid DOI format. DOI should start with '10.'",
                original_doi: doi_number,
                cleaned_doi: cleanDoiNumber
            });
        }

        // Headers for authentication
        const headers = {
            "authorization": openCitationsToken,
            "accept": "application/json",
            "User-Agent": "ASFIRJ-Journal-Platform/1.0"
        };

        // Make parallel requests for citations and citation count with retry logic
        const baseUrl = "https://api.opencitations.net/index/v2";
        
        // Encode the DOI for URL
        const encodedDoi = encodeURIComponent(cleanDoiNumber);
        
        console.log(`Making API calls to OpenCitations for DOI: ${cleanDoiNumber} (encoded: ${encodedDoi})`);
        
        // Create URLs
        const countUrl = `${baseUrl}/citation-count/doi:${encodedDoi}`;
        const citationsUrl = `${baseUrl}/citations/doi:${encodedDoi}`;
        
        console.log('Count URL:', countUrl);
        console.log('Citations URL:', citationsUrl);
        
        // Use Promise.allSettled to handle individual failures
        const results = await Promise.allSettled([
            fetchWithRetry(countUrl, { headers, method: 'GET' }, 3, 1000),
            fetchWithRetry(citationsUrl, { headers, method: 'GET' }, 3, 1000)
        ]);

        // Process results
        const errors = [];
        let citationCountResponse = null;
        let citationsResponse = null;
        
        // Handle first result (citation count)
        if (results[0].status === 'fulfilled') {
            citationCountResponse = results[0].value;
            console.log(`Citation Count Status: ${citationCountResponse.status}`);
        } else {
            errors.push(`Citation count request failed: ${results[0].reason.message}`);
            console.error('Citation count request failed:', results[0].reason.message);
        }
        
        // Handle second result (citations list)
        if (results[1].status === 'fulfilled') {
            citationsResponse = results[1].value;
            console.log(`Citations Status: ${citationsResponse.status}`);
        } else {
            errors.push(`Citations request failed: ${results[1].reason.message}`);
            console.error('Citations request failed:', results[1].reason.message);
        }

        let citationCountData = [];
        let citationsData = [];
        let totalCitations = 0;

        // Handle citation count response
        if (citationCountResponse && citationCountResponse.ok) {
            try {
                citationCountData = await citationCountResponse.json();
                totalCitations = citationCountData.length > 0 ? parseInt(citationCountData[0].count) : 0;
                console.log(`Total citations: ${totalCitations}`);
            } catch (parseError) {
                errors.push(`Failed to parse citation count response: ${parseError.message}`);
                console.error('Parse error for citation count:', parseError);
            }
        } else if (citationCountResponse) {
            errors.push(`Citation count request failed with status ${citationCountResponse.status}`);
            console.log(`Citation count not found for DOI: ${cleanDoiNumber}`);
        }

        // Handle citations response
        if (citationsResponse && citationsResponse.ok) {
            try {
                citationsData = await citationsResponse.json();
                console.log(`Retrieved ${citationsData.length} individual citations`);
            } catch (parseError) {
                errors.push(`Failed to parse citations response: ${parseError.message}`);
                console.error('Parse error for citations:', parseError);
            }
        } else if (citationsResponse) {
            errors.push(`Citations request failed with status ${citationsResponse.status}`);
            console.log(`No citations list found for DOI: ${cleanDoiNumber}`);
        }

        // Format the citations data for easier consumption
        const formattedCitations = citationsData.map(citation => ({
            oci: citation.oci || null,
            citing_doi: citation.citing || null,
            cited_doi: citation.cited || null,
            publication_date: citation.creation || null,
            timespan: citation.timespan || null,
            journal_self_citation: citation.journal_sc || null,
            author_self_citation: citation.author_sc || null
        }));

        // Prepare response
        const responseData = {
            doi: cleanDoiNumber,
            original_doi: doi_number,
            total_citations: totalCitations,
            citations_count: formattedCitations.length,
            citations: formattedCitations,
            raw_data: {
                citation_count: citationCountData,
                citations: citationsData
            }
        };

        // If there were errors but we still have some data, return partial success
        if (errors.length > 0 && (totalCitations > 0 || formattedCitations.length > 0)) {
            return res.status(207).json({
                success: true,
                partial: true,
                errors: errors,
                data: responseData
            });
        }

        // If no data found at all
        if (totalCitations === 0 && formattedCitations.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    doi: cleanDoiNumber,
                    original_doi: doi_number,
                    total_citations: 0,
                    citations_count: 0,
                    citations: [],
                    message: "No citations found for this DOI in OpenCitations",
                    note: "This could mean the DOI is not yet indexed or has no citations",
                    errors: errors.length > 0 ? errors : undefined
                }
            });
        }

        // Return the successful response
        return res.status(200).json({
            success: true,
            data: responseData
        });

    } catch (error) {
        console.error("Error fetching citations from OpenCitations:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch citation data",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

module.exports = fetchCitations;