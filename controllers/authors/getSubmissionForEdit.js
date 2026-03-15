const dbPromise = require("../../routes/dbPromise.config");

// backend/controllers/author/getSubmissionForEdit.js

const getSubmissionForEdit = async (req, res) => {
    try {
        const userEmail = req.user.email;
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ 
                status: "error", 
                message: "Manuscript ID is required" 
            });
        }

        // Get submission data
        const [submissions] = await dbPromise.query(
            `SELECT * FROM submissions WHERE revision_id = ? AND corresponding_authors_email = ?`,
            [id, userEmail]
        );

        if (submissions.length === 0) {
            return res.status(404).json({ 
                status: "error", 
                message: "Submission not found" 
            });
        }

        const submission = submissions[0];

        // Get keywords
        const [keywords] = await dbPromise.query(
            `SELECT keyword FROM submission_keywords WHERE article_id = ? ORDER BY id`,
            [id]
        );

        // Get authors
        const [authors] = await dbPromise.query(
            `SELECT * FROM submission_authors WHERE submission_id = ? ORDER BY id`,
            [id]
        );

        // Format authors for the form
        const formattedAuthors = authors.map(author => {
            // Parse name components
            const nameParts = author.authors_fullname.split(' ');
            return {
                prefix: nameParts.length > 2 ? nameParts[0] : '',
                firstName: nameParts.length > 2 ? nameParts[1] : nameParts[0] || '',
                lastName: nameParts.length > 2 ? nameParts.slice(2).join(' ') : nameParts.slice(1).join(' ') || '',
                email: author.authors_email,
                orcid: author.orcid_id,
                asfiMembershipId: author.asfi_membership_id,
                affiliation: author.affiliations,
                country: author.affiliation_country,
                city: author.affiliation_city
            };
        });

        // Get suggested reviewers
        const [reviewers] = await dbPromise.query(
            `SELECT * FROM suggested_reviewers WHERE article_id = ? ORDER BY id`,
            [id]
        );

        const formattedReviewers = reviewers.map(reviewer => ({
            fullName: reviewer.fullname,
            email: reviewer.email,
            affiliation: reviewer.affiliation,
            country: reviewer.affiliation_country,
            city: reviewer.affiliation_city
        }));

        // Parse disclosures from submission if stored, otherwise default to false
        // You might want to store disclosures in a separate table or as JSON
        const disclosures = {
            d1: true, // These should come from your database if stored
            d2: true,
            d3: true,
            d4: true,
            d5: true,
            d6: true,
            d7: true,
            d8: true
        };

        // Format response
        const response = {
            articleType: submission.article_type || '',
            discipline: submission.discipline || '',
            specialIssue: 'no', // Add to database if needed
            previousSubmission: submission.previous_manuscript_id ? 'yes' : 'no',
            previousId: submission.previous_manuscript_id || '',
            title: submission.title || '',
            abstract: submission.abstract || '',
            keywords: keywords.map(k => k.keyword).concat(Array(8 - keywords.length).fill('')),
            authors: formattedAuthors,
            reviewers: formattedReviewers,
            disclosures,
            manuscriptId: submission.revision_id,
            isWomenInScience: submission.is_women_in_contemporary_science ? 'yes' : 'no',
            files: {
                manuscript: submission.manuscript_file,
                coverLetter: submission.cover_letter_file,
                tables: submission.tables,
                figures: submission.figures,
                supplementary: submission.supplementary_material,
                graphicAbstract: submission.graphic_abstract,
                trackedManuscript: submission.tracked_manuscript_file,
                document: submission.document_file
            }
        };

        return res.json({
            status: "success",
            submission: response
        });

    } catch (error) {
        console.error("Error fetching submission for edit:", error);
        return res.status(500).json({ 
            status: "error", 
            message: "Internal server error" 
        });
    }
};

module.exports = getSubmissionForEdit;