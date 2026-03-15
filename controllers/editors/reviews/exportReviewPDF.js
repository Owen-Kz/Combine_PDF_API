// backend/controllers/editors/exportReviewPDF.js
const PDFDocument = require('pdfkit');
const db = require('../../../routes/db.config');

const exportReviewPDF = async (req, res) => {
    try {
        const { articleId, reviewId } = req.body;

        if (!articleId || !reviewId) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // Get review data
        const [reviewResults] = await db.promise().query(
            `SELECT * FROM reviews WHERE article_id = ? AND review_id = ?`,
            [articleId, reviewId]
        );

        if (reviewResults.length === 0) {
            return res.status(404).json({ error: "Review not found" });
        }

        const review = reviewResults[0];

        // Get manuscript data
        const [manuscriptResults] = await db.promise().query(
            `SELECT * FROM submissions WHERE revision_id = ?`,
            [articleId]
        );

        const manuscript = manuscriptResults[0] || {};

        // Get authors
        const [authors] = await db.promise().query(
            `SELECT authors_fullname, authors_email FROM submission_authors WHERE submission_id = ?`,
            [articleId]
        );

        // Get reviewer info
        const [reviewerResults] = await db.promise().query(
            `SELECT firstname, lastname, affiliations FROM authors_account WHERE email = ?`,
            [review.reviewer_email]
        );

        const reviewer = reviewerResults[0] || {};

        // Calculate section totals
        const section1Fields = [
            review.accurately_reflect_manuscript_subject_score,
            review.clearly_summarize_content_score,
            review.presents_what_is_known_score,
            review.gives_accurate_summary_score,
            review.purpose_clear_score,
            review.method_section_clear_score,
            review.study_materials_clearly_described_score,
            review.research_method_valid_score,
            review.ethical_standards_score,
            review.study_find_clearly_described_score,
            review.result_presented_logical_score,
            review.graphics_complement_result_score,
            review.table_follow_specified_standards_score,
            review.tables_add_value_or_distract_score,
            review.issues_with_title_score,
            review.manuscript_present_summary_of_key_findings_score,
            review.manuscript_highlight_strength_of_study_score,
            review.manuscript_compare_findings_score,
            review.manuscript_discuss_meaning_score,
            review.manuscript_describes_overall_story_score,
            review.conclusions_reflect_achievement_score,
            review.manuscript_describe_gaps_score,
            review.referencing_accurate_score
        ];

        const section2Fields = [
            review.novelty_score,
            review.quality_score,
            review.scientific_accuracy_score,
            review.overall_merit_score,
            review.english_level_score
        ];

        const section1Total = section1Fields.reduce((sum, score) => sum + (parseInt(score) || 0), 0);
        const section2Total = section2Fields.reduce((sum, score) => sum + (parseInt(score) || 0), 0);

        // Create PDF document
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=review_${articleId}_${reviewId}.pdf`);

        // Pipe PDF to response
        doc.pipe(res);

        // Add header
        doc.fontSize(20).font('Helvetica-Bold').text('ASFIRJ Review Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(2);

        // Manuscript Information
        doc.fontSize(16).font('Helvetica-Bold').text('Manuscript Information');
        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text(`ID: ${manuscript.revision_id || articleId}`);
        doc.text(`Title: ${manuscript.title || 'N/A'}`);
        doc.text(`Type: ${manuscript.article_type || 'N/A'}`);
        doc.text(`Discipline: ${manuscript.discipline || 'N/A'}`);
        doc.text(`Submitted: ${manuscript.date_submitted ? new Date(manuscript.date_submitted).toLocaleDateString() : 'N/A'}`);
        doc.moveDown();

        // Authors
        doc.fontSize(14).font('Helvetica-Bold').text('Authors');
        doc.moveDown();
        authors.forEach((author, index) => {
            doc.fontSize(12).font('Helvetica').text(`${index + 1}. ${author.authors_fullname} (${author.authors_email})`);
        });
        doc.moveDown();

        // Review Information
        doc.fontSize(16).font('Helvetica-Bold').text('Review Information');
        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text(`Review ID: ${review.review_id}`);
        doc.text(`Reviewer: ${reviewer.firstname || ''} ${reviewer.lastname || ''} (${review.reviewer_email})`);
        if (reviewer.affiliations) doc.text(`Affiliation: ${reviewer.affiliations}`);
        doc.text(`Submitted: ${review.date_completed ? new Date(review.date_completed).toLocaleString() : 'N/A'}`);
        doc.text(`Status: ${review.review_status}`);
        doc.moveDown();

        // Recommendation
        doc.fontSize(16).font('Helvetica-Bold').text('Recommendation');
        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text(`${review.overall_recommendation || 'Not specified'}`);
        doc.moveDown();

        // Scores Summary
        doc.fontSize(16).font('Helvetica-Bold').text('Scores Summary');
        doc.moveDown();
        doc.fontSize(12).font('Helvetica').text(`Section 1 Total: ${section1Total} / 115`);
        doc.text(`Section 2 Total: ${section2Total} / 25`);
        doc.text(`Overall Total: ${section1Total + section2Total} / 140`);
        doc.moveDown();

        // Comments
        if (review.one_paragraph_comment) {
            doc.fontSize(14).font('Helvetica-Bold').text('One Paragraph Summary');
            doc.moveDown();
            doc.fontSize(12).font('Helvetica').text(review.one_paragraph_comment);
            doc.moveDown();
        }

        if (review.general_comment) {
            doc.fontSize(14).font('Helvetica-Bold').text('General Comments');
            doc.moveDown();
            doc.fontSize(12).font('Helvetica').text(review.general_comment);
            doc.moveDown();
        }

        if (review.specific_comment) {
            doc.fontSize(14).font('Helvetica-Bold').text('Specific Comments');
            doc.moveDown();
            doc.fontSize(12).font('Helvetica').text(review.specific_comment);
            doc.moveDown();
        }

        if (review.letter_to_editor) {
            doc.fontSize(14).font('Helvetica-Bold').text('Confidential Comments to Editor');
            doc.moveDown();
            doc.fontSize(12).font('Helvetica').text(review.letter_to_editor);
            doc.moveDown();
        }

        // Footer
        doc.fontSize(10).font('Helvetica').text(
            'This report was generated from the ASFIRJ review system.',
            50,
            doc.page.height - 50,
            { align: 'center' }
        );

        doc.end();

    } catch (error) {
        console.error("Error exporting PDF:", error);
        return res.status(500).json({ 
            error: "Server error", 
            message: error.message 
        });
    }
};

module.exports = exportReviewPDF;