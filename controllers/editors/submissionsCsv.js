// controllers/editors/submissionsCsv.js
//
// CSV export for the editors' dashboard. Both /editors/all-submissions and
// /editors/my-submissions build the full filtered result set before paginating,
// so the export reuses that set and always contains every manuscript matching
// the active filters — not just the rows on the current page.

const COLUMNS = [
    ["Article ID", (s) => s.article_id],
    ["Revision ID", (s) => s.revision_id],
    ["Title", (s) => s.title],
    ["Corresponding Author", (s) => s.correspondingAuthor],
    ["Corresponding Email", (s) => s.correspondingEmail],
    ["Article Type", (s) => s.type],
    ["Discipline", (s) => s.discipline],
    ["Status", (s) => s.status],
    ["Submitted", (s) => formatDate(s.submittedDate || s.date)],
    ["Revisions", (s) => s.revisions_count],
    ["Corrections", (s) => s.corrections_count],
    ["Reviewers Accepted", (s) => s.reviewerInvitations?.accepted],
    ["Reviewers Pending", (s) => s.reviewerInvitations?.pending],
    ["Reviewers Declined", (s) => s.reviewerInvitations?.declined],
    ["Editors Accepted", (s) => s.editorInvitations?.accepted],
    ["Editors Pending", (s) => s.editorInvitations?.pending],
    ["Editors Declined", (s) => s.editorInvitations?.declined],
    ["New Reviews", (s) => s.newReviews],
    ["Women in Contemporary Science", (s) => (s.isWomenInScience ? "Yes" : "No")],
    ["Kidnapping for Ransom", (s) => (s.isKidnappingForRansom ? "Yes" : "No")],
    ["Belispoint Academic", (s) => (s.isBelispointAcademic ? "Yes" : "No")],
];

function formatDate(value) {
    if (!value || value === "N/A") return "";
    const date = new Date(value);
    if (isNaN(date)) return String(value);
    return date.toISOString().slice(0, 10);
}

function escapeCsv(value) {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
}

function buildSubmissionsCsv(submissions) {
    const lines = [COLUMNS.map(([header]) => escapeCsv(header)).join(",")];

    for (const submission of submissions) {
        lines.push(
            COLUMNS.map(([, read]) => escapeCsv(read(submission))).join(",")
        );
    }

    // BOM so Excel opens the file as UTF-8, CRLF line endings per RFC 4180.
    return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

function sendSubmissionsCsv(res, submissions, filenamePrefix = "manuscripts") {
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filenamePrefix}-${stamp}.csv"`
    );
    return res.send(buildSubmissionsCsv(submissions));
}

module.exports = { buildSubmissionsCsv, sendSubmissionsCsv };
