// Updated uploadArticlePage.js
const uploadArticlePage = async (req, res) => {
    try {
        const user = req.user;
        const submissionData = req.submissionData;

        // Determine submission type
        let correction = false, edit = false, revision = false;
        let currentSubmissionProcess = "new";
        
        if(req.query.correct) {
            correction = true; 
            currentSubmissionProcess = "correction";
        } else if(req.query.edit) {
            edit = true; 
            currentSubmissionProcess = "edit";
        } else if(req.query.revision || req.query.revise) {
            revision = true; 
            currentSubmissionProcess = "revision";
        }

        // Prepare template data - updated to match middleware structure
        const templateData = {
            // User data
            firstname: user.firstname,
            lastname: user.lastname,
            othername: user.othername,
            prefix: user.prefix,
            affiliation: user.affiliations,
            affiliation_country: user.affiliation_country,
            affiliation_city: user.affiliation_city,
            orcid: user.orcid_id,
            asfi_membership_id: user.asfi_membership_id,
            email: user.email,
            discipline: user.discipline,
            
            // Submission data - updated field names
            articleId: submissionData.articleId, // Changed from submission.revision_id
            article_id: submissionData.articleId, // Use articleId for consistency
            title: submissionData.submission?.title || null,
            article_discipline: submissionData.submission?.discipline || null,
            article_type: submissionData.submission?.article_type || null,
            manuscript_file: submissionData.submission?.manuscript_file || null,
            tracked_manuscript_file: submissionData.submission?.tracked_manuscript_file || null,
            coverLetter: submissionData.submission?.cover_letter_file || null,
            tables: submissionData.submission?.tables || null,
            figures: submissionData.submission?.figures || null,
            graphic_abstract: submissionData.submission?.graphic_abstract || null,
            SavedAbstract: submissionData.submission?.abstract || null,
            supplementaryMaterials: submissionData.submission?.supplementary_material || null,
            correspondingAuthor: submissionData.submission?.corresponding_authors_email || user.email,
            previousId: submissionData.submission?.previous_manuscript_id || null,
            status: submissionData.submission?.status || 'draft',
            is_women_in_contemporary: submissionData.submission?.is_women_in_contemporary_science || "no",
            
            // Related data
            Keywords: submissionData.keywords || [],
            Authors: submissionData.authors || [],
            suggestedReviewers: submissionData.suggestedReviewers || [],
            
            // Process data
            currentProcess: submissionData.submission?.status || "draft",
            _uid_token: req.query._uid,
            correction,
            edit,
            revision,
            currentSubmissionProcess,
            queriedID: req.query.a ? `a=${req.query.a}` : "",
            isNewSubmission: submissionData.isNew
        };

        return res.render("uploadPage", templateData);

    } catch (error) {
        console.error("Error in uploadArticlePage:", error);
        return res.status(500).json({ error: "Failed to load submission page" });
    }
};

module.exports = uploadArticlePage;