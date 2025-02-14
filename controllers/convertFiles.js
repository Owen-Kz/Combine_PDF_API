const db = require("../routes/db.config");
const { config } = require("dotenv");

const convertFiles = async (req, res) => {
  try {
    const { a } = req.query;

    db.query(
      "SELECT manuscript_file, tables, figures, graphic_abstract, supplementary_material FROM submissions WHERE revision_id = ?",
      [a],
      async (err, data) => {
        if (err) {
          console.error("Database Error:", err);
          return res.json({ url: `/combineFiles?status=error&message=${encodeURIComponent(err.message)}&tag=Internal Server Error` });
        }

        if (data.length === 0) {
          return res.json({ url: `/combineFiles?status=error&message=${encodeURIComponent("No files found")}&tag=File not found` });
        }

        // Filter out empty or null file fields
        const files = [
          data[0].manuscript_file,
          data[0].tables,
          data[0].figures,
          data[0].graphic_abstract,
          data[0].supplementary_material,
        ].filter(file => file && file.trim() !== "");

        if (files.length === 0) {
          return res.json({ url: `/combineFiles?status=error&message=${encodeURIComponent("No valid files found")}&tag=Invalid Files` });
        }
        const response = await fetch(`${process.env.ASFI_SCHOLAR}/mergeFilesAPI`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({a, files})
        });
        
        const responseData = await response.json(); 

        if(responseData){
        return res.json(responseData)
        }else{
    return res.json({ url: `/combineFiles?status=error&message=${encodeURIComponent("Could not fetch host")}&tag=Something Went Wrong` });
            
        }

      
      }
    );
  } catch (error) {
    return res.json({ url: `/combineFiles?status=error&message=${encodeURIComponent(error.message)}&tag=Something Went Wrong` });
  }
};

module.exports = convertFiles;
