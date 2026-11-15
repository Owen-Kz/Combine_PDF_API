// controllers/account/invitations/isManuscriptAuthor.js
//
// Single source of truth for "is this email one of the manuscript's authors?".
//
// Used by the reviewer-invite and editor-invite flows. Earlier each controller
// ran its own query with slightly different assumptions:
//   * emails were compared verbatim, so a stray space or different casing in
//     the form produced a false negative,
//   * the manuscript was matched only on the id the caller happened to have,
//     while submission_authors rows are keyed by revision id (older rows used
//     the base article id), and
//   * the reviewer controller treated the [rows, fields] tuple returned by the
//     pool as the row list, so the check matched every email.
//
// This helper resolves every id the manuscript is known by and compares the
// stored address case-insensitively with surrounding whitespace ignored.

const db = require("../../../routes/dbPromise.config");

const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();

async function isManuscriptAuthor(email, articleId) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !articleId) return false;

    // The callers pass whichever id they hold (revision id in most screens,
    // base article id in others). Collect both so the check works either way.
    const manuscriptIds = new Set([String(articleId)]);
    try {
        const [manuscripts] = await db.query(
            `SELECT revision_id, article_id
               FROM submissions
              WHERE revision_id = ? OR article_id = ?
              LIMIT 1`,
            [articleId, articleId]
        );
        if (manuscripts.length > 0) {
            if (manuscripts[0].revision_id) manuscriptIds.add(String(manuscripts[0].revision_id));
            if (manuscripts[0].article_id) manuscriptIds.add(String(manuscripts[0].article_id));
        }
    } catch (error) {
        // If the lookup fails, still check the id we were given rather than
        // blocking the invitation.
        console.error("isManuscriptAuthor: manuscript lookup failed:", error.message);
    }

    const [authors] = await db.query(
        `SELECT 1
           FROM submission_authors
          WHERE LOWER(TRIM(authors_email)) = ?
            AND submission_id IN (?)
          LIMIT 1`,
        [normalizedEmail, [...manuscriptIds]]
    );

    return authors.length > 0;
}

module.exports = { isManuscriptAuthor, normalizeEmail };
