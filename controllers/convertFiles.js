const db = require("../routes/db.config");
const { config } = require("dotenv");

const convertFiles = async (req, res) => {
  try {
    // Validate request query parameters
    console.log(req.query)
    if (!req.query || typeof req.query !== 'object') {
      console.error('Invalid request query parameters');
      return res.status(400).json({ 
        url: `/combineFiles?status=error&message=${encodeURIComponent("Invalid request parameters")}&tag=Bad Request` 
      });
    }

    const { a } = req.query;

    // Validate required parameter
    if (!a) {
      console.error('Missing revision_id parameter');
      return res.status(400).json({ 
        url: `/combineFiles?status=error&message=${encodeURIComponent("Revision ID is required")}&tag=Missing Parameter` 
      });
    }

    // Validate database connection
    if (!db || typeof db.query !== 'function') {
      console.error('Database connection is not available');
      return res.status(500).json({ 
        url: `/combineFiles?status=error&message=${encodeURIComponent("Database connection error")}&tag=Database Error` 
      });
    }

    db.query(
      "SELECT manuscript_file, tables, figures, graphic_abstract, supplementary_material FROM submissions WHERE revision_id = ?",
      [a],
      async (err, data) => {
        try {
          if (err) {
            console.error("Database Query Error:", err);
            return res.status(500).json({ 
              url: `/combineFiles?status=error&message=${encodeURIComponent("Database query failed")}&tag=Database Error` 
            });
          }

          // Validate query response data
          if (!data || !Array.isArray(data)) {
            console.error('Invalid database response format');
            return res.status(500).json({ 
              url: `/combineFiles?status=error&message=${encodeURIComponent("Invalid database response")}&tag=Server Error` 
            });
          }

          if (data.length === 0) {
            console.warn(`No files found for revision_id: ${a}`);
            return res.status(404).json({ 
              url: `/combineFiles?status=error&message=${encodeURIComponent("No files found for the specified revision")}&tag=Not Found` 
            });
          }

          // Safely extract file fields with null checks
          const submission = data[0];
          if (!submission || typeof submission !== 'object') {
            console.error('Invalid submission data structure');
            return res.status(500).json({ 
              url: `/combineFiles?status=error&message=${encodeURIComponent("Invalid file data structure")}&tag=Server Error` 
            });
          }

          // Filter out empty or null file fields safely
          const files = [
            submission.manuscript_file,
            submission.tables,
            submission.figures,
            submission.graphic_abstract,
            submission.supplementary_material,
          ].filter(file => file && typeof file === 'string' && file.trim() !== "");

          if (files.length === 0) {
            console.warn(`No valid files found for revision_id: ${a}`);
            return res.status(404).json({ 
              url: `/combineFiles?status=error&message=${encodeURIComponent("No valid files available for processing")}&tag=No Files` 
            });
          }

          // Validate environment variable
          if (!process.env.ASFI_SCHOLAR) {
            console.error('ASFI_SCHOLAR environment variable is not set');
            return res.status(500).json({ 
              url: `/combineFiles?status=error&message=${encodeURIComponent("Server configuration error")}&tag=Configuration Error` 
            });
          }

          // Validate fetch API availability
          if (typeof fetch !== 'function') {
            console.error('Fetch API is not available');
            return res.status(500).json({ 
              url: `/combineFiles?status=error&message=${encodeURIComponent("Server functionality unavailable")}&tag=Server Error` 
            });
          }

          let response;
          try {
            response = await fetch(`${process.env.ASFI_SCHOLAR}/mergeFilesAPI`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ a, files }),
              // Add timeout handling
              signal: AbortSignal.timeout(30000) // 30 second timeout
            });
          
          } catch (fetchError) {
            console.error('Fetch request failed:', fetchError);
            return res.status(502).json({ 
              url: `/combineFiles?status=error&message=${encodeURIComponent("Unable to connect to file processing service")}&tag=Service Unavailable` 
            });
          }

          // Validate response
          if (!response || !response.ok) {
            console.error(`External API responded with status: ${response?.status}`);
            return res.status(502).json({ 
              url: `/combineFiles?status=error&message=${encodeURIComponent("File processing service returned an error")}&tag=Service Error` 
            });
          }

          let responseData;
          try {
            responseData = await response.json();
          } catch (jsonError) {
            console.error('Failed to parse JSON response:', jsonError);
            return res.status(502).json({ 
              url: `/combineFiles?status=error&message=${encodeURIComponent("Invalid response from file processing service")}&tag=Service Error` 
            });
          }

          // Validate response data structure
          if (!responseData || typeof responseData !== 'object') {
            console.error('Invalid response data structure from external API');
            return res.status(502).json({ 
              url: `/combineFiles?status=error&message=${encodeURIComponent("Invalid response format from service")}&tag=Service Error` 
            });
          }

          // Return successful response
          return res.json(responseData);

        } catch (nestedError) {
          console.error('Error in database callback:', nestedError);
          return res.status(500).json({ 
            url: `/combineFiles?status=error&message=${encodeURIComponent("Internal server error during file processing")}&tag=Internal Error` 
          });
        }
      }
    );

  } catch (outerError) {
    console.error('Unexpected error in convertFiles:', outerError);
    return res.status(500).json({ 
      url: `/combineFiles?status=error&message=${encodeURIComponent("Unexpected server error occurred")}&tag=Internal Server Error` 
    });
  }
};

module.exports = convertFiles;