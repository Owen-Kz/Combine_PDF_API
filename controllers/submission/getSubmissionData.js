const db = require("../../routes/db.config");
const dbPromise = require("../../routes/dbPromise.config");

const getSubmissionData = async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ error: "User not found" });
    }

    if (req.user) {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: "Invalid Parameters" });
      }

      // First, get the submission data
      const submissionQuery = "SELECT * FROM `submissions` WHERE `revision_id` = ?";

      db.query(submissionQuery, [id], async (error, submissionResults) => {
        if (error) {
          console.log(error);
          return res.status(500).json({ error: error.message });
        }

        if (submissionResults.length === 0) {
          return res.json({ error: "No submission data found" });
        }

        const submission = submissionResults[0];

        // Get corresponding author details from authors_account
        const authorQuery = `
          SELECT 
            aa.*,
            CONCAT_WS(' ', 
              aa.prefix,
              aa.firstname,
              aa.lastname
            ) AS full_name
          FROM authors_account aa
          WHERE aa.email = ?
        `;

        db.query(authorQuery, [submission.corresponding_authors_email], async (authorError, authorResults) => {
          if (authorError) {
            console.log(authorError);
            // Still return submission data even if author details fail
            return res.json({
              success: "Submission Data Found",
              articles: submission,
              author_details: null,
              warning: "Could not fetch author details"
            });
          }
          const [authors] = await dbPromise.query(
            "SELECT authors_fullname as name, authors_email as email FROM submission_authors WHERE submission_id = ?",
            [id]
          );
          // Combine submission data with author details
          const articleData = {
            ...submission,
            authors: authors || [],
            corresponding_author_details: authorResults.length > 0 ? authorResults[0] : null,
            corresponding_author_fullname: authorResults.length > 0
              ? authorResults[0].full_name ||
              `${authorResults[0].prefix || ''} ${authorResults[0].fullname || ''} ${authorResults[0].lastname || ''}`.trim()
              : submission.corresponding_author || '',
            corresponding_author_email: submission.corresponding_authors_email,
            corresponding_author_prefix: authorResults.length > 0 ? authorResults[0].prefix : null,
            corresponding_author_firstname: authorResults.length > 0 ? authorResults[0].fullname : null,
            corresponding_author_lastname: authorResults.length > 0 ? authorResults[0].lastname : null,
            corresponding_author_affiliation: authorResults.length > 0 ? authorResults[0].affiliation : null,
            corresponding_author_orcid: authorResults.length > 0 ? authorResults[0].orcid_id : null
          };

          return res.json({
            success: "Submission Data Found",
            articles: articleData
          });
        });
      });
    }
  } catch (error) {
    console.log(error);
    return res.json({ error: error.message });
  }
};

module.exports = getSubmissionData;