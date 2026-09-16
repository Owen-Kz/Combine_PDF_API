// backend/controllers/author/submitRevision.js
//
// Handles revision submissions ONLY. All shared logic (file uploads, ID
// generation, database upsert, counters, emails) lives in
// submitDerivedSubmission.js so this file stays a thin type-specific wrapper.

const submitDerivedSubmission = require("./submitDerivedSubmission");

const submitRevision = async (req, res) => {
    return submitDerivedSubmission(req, res, { type: "revision" });
};

module.exports = submitRevision;