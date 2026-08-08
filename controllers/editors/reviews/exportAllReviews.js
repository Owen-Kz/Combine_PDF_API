const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, PageBreak } = require('docx');
const db = require('../../../routes/db.config');
const isAdminAccount = require("../isAdminAccount");
const { SECTION1_FIELDS, SECTION2_FIELDS, SECTION1_MAX, SECTION2_MAX, OVERALL_MAX } = require("./scoreFields");

const computeTotals = (review) => {
    const section1Total = SECTION1_FIELDS.reduce((sum, f) => sum + (parseInt(review[f.field]) || 0), 0);
    const section2Total = SECTION2_FIELDS.reduce((sum, f) => sum + (parseInt(review[f.field]) || 0), 0);
    return { section1Total, section2Total, overallTotal: section1Total + section2Total };
};

const formatDate = (value) => value ? new Date(value).toLocaleString() : 'N/A';

const buildScoreTable = (fields, review) => {
    const rows = [new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ text: 'Question', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Score (1-5)', bold: true })], width: { size: 1200, type: WidthType.DXA } })
        ]
    })];
    fields.forEach(({ field, question }) => {
        rows.push(new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ text: question })] }),
                new TableCell({ children: [new Paragraph({ text: String(review[field] || 0) })], width: { size: 1200, type: WidthType.DXA } })
            ]
        }));
    });
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
};

const exportAllReviews = async (req, res) => {
    try {
        const { articleId, articleIds, reviewIds, format } = req.body;
        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        if (!(await isAdminAccount(userId))) {
            return res.status(403).json({ error: "You do not have permission to perform this action" });
        }

        // Resolve manuscript ids (accept single articleId or array articleIds)
        const ids = (Array.isArray(articleIds) && articleIds.length > 0)
            ? articleIds
            : (articleId ? [articleId] : []);

        if (ids.length === 0) {
            return res.status(400).json({ error: "Missing required parameter: articleId or articleIds" });
        }

        const requestedFormat = (format || "pdf").toLowerCase();
        if (!["pdf", "docx"].includes(requestedFormat)) {
            return res.status(400).json({ error: "Unsupported format. Use 'pdf' or 'docx'" });
        }

        // Get manuscript data (dedup: keep the row with the MIN(id) per revision_id)
        const [manuscriptRows] = await db.promise().query(
            `SELECT * FROM submissions WHERE revision_id IN (?) ORDER BY id ASC`,
            [ids]
        );

        const manuscripts = [];
        const seenRevisions = new Set();
        manuscriptRows.forEach((row) => {
            if (!seenRevisions.has(row.revision_id)) {
                seenRevisions.add(row.revision_id);
                manuscripts.push(row);
            }
        });

        if (manuscripts.length === 0) {
            return res.status(404).json({ error: "Manuscripts not found" });
        }

        // Get authors for the manuscripts
        const [authorRows] = await db.promise().query(
            `SELECT submission_id, authors_fullname, authors_email FROM submission_authors WHERE submission_id IN (?) ORDER BY submission_id, id ASC`,
            [ids]
        );

        const authorsBySubmission = {};
        authorRows.forEach((author) => {
            if (!authorsBySubmission[author.submission_id]) {
                authorsBySubmission[author.submission_id] = [];
            }
            authorsBySubmission[author.submission_id].push(author);
        });

        // Get submitted reviews (optionally filtered to specific review ids)
        let reviews = [];
        if (Array.isArray(reviewIds) && reviewIds.length > 0) {
            const [rows] = await db.promise().query(
                `SELECT r.*, CONCAT_WS(' ', a.prefix, a.firstname, a.lastname) AS reviewer_name, a.affiliations
                 FROM reviews r
                 LEFT JOIN authors_account a ON r.reviewer_email = a.email
                 WHERE r.article_id IN (?)
                   AND r.review_id IN (?)
                   AND r.review_status IN ('review_submitted', 'submitted', 'completed')
                 ORDER BY r.article_id, r.id ASC`,
                [ids, reviewIds]
            );
            reviews = rows;
        } else {
            const [rows] = await db.promise().query(
                `SELECT r.*, CONCAT_WS(' ', a.prefix, a.firstname, a.lastname) AS reviewer_name, a.affiliations
                 FROM reviews r
                 LEFT JOIN authors_account a ON r.reviewer_email = a.email
                 WHERE r.article_id IN (?)
                   AND r.review_status IN ('review_submitted', 'submitted', 'completed')
                 ORDER BY r.article_id, r.id ASC`,
                [ids]
            );
            reviews = rows;
        }

        // Group reviews by article
        const reviewsByArticle = {};
        reviews.forEach((review) => {
            if (!reviewsByArticle[review.article_id]) {
                reviewsByArticle[review.article_id] = [];
            }
            reviewsByArticle[review.article_id].push(review);
        });

        // Only include manuscripts that have at least one submitted review
        const exportableManuscripts = manuscripts.filter((m) => (reviewsByArticle[m.revision_id] || []).length > 0);

        if (exportableManuscripts.length === 0) {
            return res.status(404).json({ error: "No submitted reviews found for the selected manuscripts" });
        }

        if (requestedFormat === "docx") {
            return await buildDocx(res, exportableManuscripts, reviewsByArticle, authorsBySubmission);
        }

        return await buildPdf(res, exportableManuscripts, reviewsByArticle, authorsBySubmission);
    } catch (error) {
        console.error("Error exporting reviews:", error);
        return res.status(500).json({ error: "Server error", message: error.message });
    }
};

const buildPdf = async (res, manuscripts, reviewsByArticle, authorsBySubmission) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=selected_reviews.pdf`);
    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('ASFIRJ Reviewer Reports', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    manuscripts.forEach((manuscript, manuscriptIndex) => {
        if (manuscriptIndex > 0) {
            doc.addPage();
        }

        const authorList = (authorsBySubmission[manuscript.revision_id] || [])
            .map((author, index) => `${index + 1}. ${author.authors_fullname} (${author.authors_email})`)
            .join("\n");

        doc.fontSize(16).font('Helvetica-Bold').text('Manuscript Information');
        doc.moveDown();
        doc.fontSize(12).font('Helvetica');
        doc.text(`ID: ${manuscript.revision_id}`);
        doc.text(`Title: ${manuscript.title || 'N/A'}`);
        doc.text(`Type: ${manuscript.article_type || 'N/A'}`);
        doc.text(`Discipline: ${manuscript.discipline || 'N/A'}`);
        if (authorList) {
            doc.text('Authors:');
            doc.text(authorList);
        }
        doc.moveDown();

        (reviewsByArticle[manuscript.revision_id] || []).forEach((review, index) => {
            const { section1Total, section2Total, overallTotal } = computeTotals(review);
            const reviewerName = (review.reviewer_name || '').trim() || review.reviewer_email.split('@')[0] || 'Anonymous';

            doc.addPage();

            doc.fontSize(16).font('Helvetica-Bold').text(`Reviewer Report ${index + 1}`);
            doc.moveDown();
            doc.fontSize(12).font('Helvetica');
            doc.text(`Manuscript: ${manuscript.revision_id}`);
            doc.text(`Review ID: ${review.review_id}`);
            doc.text(`Reviewer: ${reviewerName} (${review.reviewer_email})`);
            if (review.affiliations) doc.text(`Affiliation: ${review.affiliations}`);
            doc.text(`Submitted: ${formatDate(review.date_completed)}`);
            doc.text(`Status: ${review.review_status}`);
            doc.moveDown();

            doc.fontSize(14).font('Helvetica-Bold').text('Recommendation');
            doc.moveDown();
            doc.fontSize(12).font('Helvetica').text(`${review.overall_recommendation || 'Not specified'}`);
            doc.moveDown();

            doc.fontSize(14).font('Helvetica-Bold').text(`Section 1: Detailed Scoring (Total: ${section1Total}/${SECTION1_MAX})`);
            doc.moveDown();
            SECTION1_FIELDS.forEach(({ field, question }) => {
                doc.fontSize(10).font('Helvetica').text(question);
                doc.text(`Score: ${review[field] || 0}/5`);
                doc.moveDown(0.3);
            });
            doc.moveDown();

            doc.fontSize(14).font('Helvetica-Bold').text(`Section 2: Overall Rating (Total: ${section2Total}/${SECTION2_MAX})`);
            doc.moveDown();
            SECTION2_FIELDS.forEach(({ field, question }) => {
                doc.fontSize(10).font('Helvetica').text(question);
                doc.text(`Score: ${review[field] || 0}/5`);
                doc.moveDown(0.3);
            });
            doc.moveDown();

            doc.fontSize(12).font('Helvetica-Bold').text(`Overall Total Score: ${overallTotal}/${OVERALL_MAX}`);
            doc.moveDown();

            const comments = [
                ['One Paragraph Summary', review.one_paragraph_comment],
                ['General Comments', review.general_comment],
                ['Specific Comments', review.specific_comment],
                ['Confidential Comments to Editor', review.letter_to_editor]
            ];

            comments.forEach(([label, text]) => {
                if (text) {
                    doc.fontSize(14).font('Helvetica-Bold').text(label);
                    doc.moveDown();
                    doc.fontSize(12).font('Helvetica').text(String(text));
                    doc.moveDown();
                }
            });
        });
    });

    doc.fontSize(10).font('Helvetica').text(
        'This report was generated from the ASFIRJ review system.',
        50,
        doc.page.height - 50,
        { align: 'center' }
    );

    doc.end();
};

const buildDocx = async (res, manuscripts, reviewsByArticle, authorsBySubmission) => {
    const children = [];

    children.push(new Paragraph({ text: 'ASFIRJ Reviewer Reports', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
    children.push(new Paragraph({ text: `Generated: ${new Date().toLocaleString()}`, alignment: AlignmentType.CENTER }));
    children.push(new Paragraph({ text: '' }));

    manuscripts.forEach((manuscript, manuscriptIndex) => {
        const authors = authorsBySubmission[manuscript.revision_id] || [];

        if (manuscriptIndex > 0) {
            children.push(new Paragraph({ children: [new PageBreak()] }));
        }

        children.push(new Paragraph({ text: 'Manuscript Information', heading: HeadingLevel.HEADING_2 }));
        children.push(new Paragraph({ text: `ID: ${manuscript.revision_id}` }));
        children.push(new Paragraph({ text: `Title: ${manuscript.title || 'N/A'}` }));
        children.push(new Paragraph({ text: `Type: ${manuscript.article_type || 'N/A'}` }));
        children.push(new Paragraph({ text: `Discipline: ${manuscript.discipline || 'N/A'}` }));
        if (authors.length) {
            children.push(new Paragraph({ text: 'Authors:' }));
            authors.forEach((author, index) => {
                children.push(new Paragraph({ text: `${index + 1}. ${author.authors_fullname} (${author.authors_email})`, indent: { left: 400 } }));
            });
        }
        children.push(new Paragraph({ text: '' }));

        (reviewsByArticle[manuscript.revision_id] || []).forEach((review, index) => {
            const { section1Total, section2Total, overallTotal } = computeTotals(review);
            const reviewerName = (review.reviewer_name || '').trim() || review.reviewer_email.split('@')[0] || 'Anonymous';

            if (index > 0) {
                children.push(new Paragraph({ children: [new PageBreak()] }));
            }

            children.push(new Paragraph({ text: `Reviewer Report ${index + 1}`, heading: HeadingLevel.HEADING_1 }));
            children.push(new Paragraph({ text: `Manuscript: ${manuscript.revision_id}` }));
            children.push(new Paragraph({ text: `Review ID: ${review.review_id}` }));
            children.push(new Paragraph({ text: `Reviewer: ${reviewerName} (${review.reviewer_email})` }));
            if (review.affiliations) children.push(new Paragraph({ text: `Affiliation: ${review.affiliations}` }));
            children.push(new Paragraph({ text: `Submitted: ${formatDate(review.date_completed)}` }));
            children.push(new Paragraph({ text: `Status: ${review.review_status}` }));
            children.push(new Paragraph({ text: '' }));

            children.push(new Paragraph({ text: 'Recommendation', heading: HeadingLevel.HEADING_2 }));
            children.push(new Paragraph({ text: `${review.overall_recommendation || 'Not specified'}` }));
            children.push(new Paragraph({ text: '' }));

            children.push(new Paragraph({ text: `Section 1: Detailed Scoring (Total: ${section1Total}/${SECTION1_MAX})`, heading: HeadingLevel.HEADING_2 }));
            children.push(buildScoreTable(SECTION1_FIELDS, review));
            children.push(new Paragraph({ text: '' }));

            children.push(new Paragraph({ text: `Section 2: Overall Rating (Total: ${section2Total}/${SECTION2_MAX})`, heading: HeadingLevel.HEADING_2 }));
            children.push(buildScoreTable(SECTION2_FIELDS, review));
            children.push(new Paragraph({ text: '' }));
            children.push(new Paragraph({ children: [new TextRun({ text: `Overall Total Score: ${overallTotal}/${OVERALL_MAX}`, bold: true })] }));
            children.push(new Paragraph({ text: '' }));

            const comments = [
                ['One Paragraph Summary', review.one_paragraph_comment],
                ['General Comments', review.general_comment],
                ['Specific Comments', review.specific_comment],
                ['Confidential Comments to Editor', review.letter_to_editor]
            ];

            comments.forEach(([label, text]) => {
                if (text) {
                    children.push(new Paragraph({ text: label, heading: HeadingLevel.HEADING_2 }));
                    children.push(new Paragraph({ text: String(text) }));
                    children.push(new Paragraph({ text: '' }));
                }
            });
        });
    });

    const doc = new Document({ sections: [{ properties: {}, children }] });
    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=selected_reviews.docx`);
    return res.send(buffer);
};

module.exports = exportAllReviews;
