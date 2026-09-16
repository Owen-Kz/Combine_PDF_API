// backend/controllers/author/submitCorrection.js
//
// Handles correction submissions ONLY. All shared logic (file uploads, ID
// generation, database upsert, counters, emails) lives in
// submitDerivedSubmission.js so this file stays a thin type-specific wrapper.

const submitDerivedSubmission = require("./submitDerivedSubmission");

const submitCorrection = async (req, res) => {
    return submitDerivedSubmission(req, res, { type: "correction" });
};

module.exports = submitCorrection;