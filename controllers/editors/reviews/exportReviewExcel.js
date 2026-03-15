// backend/controllers/editors/exportReviewExcel.js
const ExcelJS = require('exceljs');
const db = require('../../../routes/db.config');

const exportReviewExcel = async (req, res) => {
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

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'ASFIRJ';
        workbook.created = new Date();

        // Add Summary Sheet
        const summarySheet = workbook.addWorksheet('Summary');
        
        // Add title
        summarySheet.mergeCells('A1:D1');
        const titleRow = summarySheet.getCell('A1');
        titleRow.value = 'ASFIRJ Review Report';
        titleRow.font = { size: 16, bold: true };
        titleRow.alignment = { horizontal: 'center' };

        summarySheet.mergeCells('A2:D2');
        const dateRow = summarySheet.getCell('A2');
        dateRow.value = `Generated: ${new Date().toLocaleString()}`;
        dateRow.font = { size: 12 };
        dateRow.alignment = { horizontal: 'center' };

        // Manuscript Information
        summarySheet.addRow([]);
        summarySheet.addRow(['MANUSCRIPT INFORMATION']);
        summarySheet.getRow(4).font = { bold: true };
        summarySheet.addRow(['ID:', manuscript.revision_id || articleId]);
        summarySheet.addRow(['Title:', manuscript.title || 'N/A']);
        summarySheet.addRow(['Type:', manuscript.article_type || 'N/A']);
        summarySheet.addRow(['Discipline:', manuscript.discipline || 'N/A']);
        summarySheet.addRow(['Submitted:', manuscript.date_submitted ? new Date(manuscript.date_submitted).toLocaleDateString() : 'N/A']);

        // Authors
        summarySheet.addRow([]);
        summarySheet.addRow(['AUTHORS']);
        summarySheet.getRow(12).font = { bold: true };
        authors.forEach((author, index) => {
            summarySheet.addRow([`${index + 1}.`, author.authors_fullname, author.authors_email]);
        });

        // Review Information
        summarySheet.addRow([]);
        summarySheet.addRow(['REVIEW INFORMATION']);
        summarySheet.getRow(12 + authors.length + 2).font = { bold: true };
        summarySheet.addRow(['Review ID:', review.review_id]);
        summarySheet.addRow(['Reviewer:', `${reviewer.firstname || ''} ${reviewer.lastname || ''}`]);
        summarySheet.addRow(['Reviewer Email:', review.reviewer_email]);
        if (reviewer.affiliations) summarySheet.addRow(['Affiliation:', reviewer.affiliations]);
        summarySheet.addRow(['Submitted:', review.date_completed ? new Date(review.date_completed).toLocaleString() : 'N/A']);
        summarySheet.addRow(['Status:', review.review_status]);
        summarySheet.addRow(['Recommendation:', review.overall_recommendation || 'Not specified']);

        // Add Scores Sheet
        const scoresSheet = workbook.addWorksheet('Scores');

        // Title
        scoresSheet.mergeCells('A1:C1');
        scoresSheet.getCell('A1').value = 'Section 1: Detailed Scoring';
        scoresSheet.getCell('A1').font = { size: 14, bold: true };

        // Section 1 scores
        const scores = [
            ['Title and Abstract'],
            ['Title accurately reflects subject', review.accurately_reflect_manuscript_subject_score],
            ['Abstract clearly summarizes content', review.clearly_summarize_content_score],
            ['Introduction'],
            ['Presents what is known/unknown', review.presents_what_is_known_score],
            ['Accurate summary of recent research', review.gives_accurate_summary_score],
            ['Purpose clear', review.purpose_clear_score],
            ['Methods'],
            ['Methods section clear', review.method_section_clear_score],
            ['Materials clearly described', review.study_materials_clearly_described_score],
            ['Research methods valid', review.research_method_valid_score],
            ['Ethical standards followed', review.ethical_standards_score],
            ['Results'],
            ['Findings clearly described', review.study_find_clearly_described_score],
            ['Results presented logically', review.result_presented_logical_score],
            ['Graphics complement results', review.graphics_complement_result_score],
            ['Graphics follow standards', review.table_follow_specified_standards_score],
            ['Tables add value', review.tables_add_value_or_distract_score],
            ['Issues with graphics', review.issues_with_title_score],
            ['Discussion'],
            ['Summary of key findings', review.manuscript_present_summary_of_key_findings_score],
            ['Strengths/limitations highlighted', review.manuscript_highlight_strength_of_study_score],
            ['Compares with similar papers', review.manuscript_compare_findings_score],
            ['Discusses implications', review.manuscript_discuss_meaning_score],
            ['Describes overall story', review.manuscript_describes_overall_story_score],
            ['Conclusions reflect aims', review.conclusions_reflect_achievement_score],
            ['Discusses gaps', review.manuscript_describe_gaps_score],
            ['Referencing accurate', review.referencing_accurate_score]
        ];

        let row = 3;
        scores.forEach(item => {
            if (item.length === 1) {
                scoresSheet.mergeCells(`A${row}:C${row}`);
                scoresSheet.getCell(`A${row}`).value = item[0];
                scoresSheet.getCell(`A${row}`).font = { bold: true };
            } else {
                scoresSheet.getCell(`A${row}`).value = item[0];
                scoresSheet.getCell(`B${row}`).value = item[1];
            }
            row++;
        });

        // Section 2
        row += 2;
        scoresSheet.mergeCells(`A${row}:C${row}`);
        scoresSheet.getCell(`A${row}`).value = 'Section 2: Overall Rating';
        scoresSheet.getCell(`A${row}`).font = { size: 14, bold: true };
        row++;

        const section2Scores = [
            ['Novelty', review.novelty_score],
            ['Quality', review.quality_score],
            ['Scientific Accuracy', review.scientific_accuracy_score],
            ['Overall Merit', review.overall_merit_score],
            ['English Level', review.english_level_score]
        ];

        section2Scores.forEach(score => {
            scoresSheet.getCell(`A${row}`).value = score[0];
            scoresSheet.getCell(`B${row}`).value = score[1];
            row++;
        });

        // Format columns
        scoresSheet.getColumn('A').width = 50;
        scoresSheet.getColumn('B').width = 10;
        scoresSheet.getColumn('B').alignment = { horizontal: 'center' };

        // Add Comments Sheet
        const commentsSheet = workbook.addWorksheet('Comments');

        let commentRow = 1;

        if (review.one_paragraph_comment) {
            commentsSheet.mergeCells(`A${commentRow}:C${commentRow}`);
            commentsSheet.getCell(`A${commentRow}`).value = 'One Paragraph Summary';
            commentsSheet.getCell(`A${commentRow}`).font = { bold: true };
            commentRow++;
            commentsSheet.mergeCells(`A${commentRow}:C${commentRow}`);
            commentsSheet.getCell(`A${commentRow}`).value = review.one_paragraph_comment;
            commentRow += 3;
        }

        if (review.general_comment) {
            commentsSheet.mergeCells(`A${commentRow}:C${commentRow}`);
            commentsSheet.getCell(`A${commentRow}`).value = 'General Comments';
            commentsSheet.getCell(`A${commentRow}`).font = { bold: true };
            commentRow++;
            commentsSheet.mergeCells(`A${commentRow}:C${commentRow}`);
            commentsSheet.getCell(`A${commentRow}`).value = review.general_comment;
            commentRow += 3;
        }

        if (review.specific_comment) {
            commentsSheet.mergeCells(`A${commentRow}:C${commentRow}`);
            commentsSheet.getCell(`A${commentRow}`).value = 'Specific Comments';
            commentsSheet.getCell(`A${commentRow}`).font = { bold: true };
            commentRow++;
            commentsSheet.mergeCells(`A${commentRow}:C${commentRow}`);
            commentsSheet.getCell(`A${commentRow}`).value = review.specific_comment;
            commentRow += 3;
        }

        if (review.letter_to_editor) {
            commentsSheet.mergeCells(`A${commentRow}:C${commentRow}`);
            commentsSheet.getCell(`A${commentRow}`).value = 'Confidential Comments to Editor';
            commentsSheet.getCell(`A${commentRow}`).font = { bold: true };
            commentRow++;
            commentsSheet.mergeCells(`A${commentRow}:C${commentRow}`);
            commentsSheet.getCell(`A${commentRow}`).value = review.letter_to_editor;
        }

        commentsSheet.getColumn('A').width = 80;

        // Write to buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=review_${articleId}_${reviewId}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error("Error exporting Excel:", error);
        return res.status(500).json({ 
            error: "Server error", 
            message: error.message 
        });
    }
};

module.exports = exportReviewExcel;