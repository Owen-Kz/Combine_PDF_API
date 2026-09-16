// controllers/utils/submissionIdUtils.js
//
// Shared helpers for detecting, stripping, and classifying revision/correction
// suffixes on submission IDs. Both the legacy dot format (ASFIRJ-2025-1.R1)
// and the new underscore format (ASFIRJ-2025-1_R1) are supported.

const SUFFIX_RE = /([._])(Cr|R)[a-zA-Z0-9]*$/i;

/**
 * Returns true if the given id already carries a revision or correction suffix.
 */
function hasDerivedSuffix(id) {
    if (!id) return false;
    return SUFFIX_RE.test(String(id));
}

/**
 * Strips the trailing revision/correction suffix, returning the base article id.
 * If no suffix is found the id is returned unchanged.
 */
function stripDerivedSuffix(id) {
    if (!id) return id;
    return String(id).replace(SUFFIX_RE, '');
}

/**
 * Classifies an id's suffix into a type string:
 *   'correction' | 'revision' | null
 */
function getDerivedType(id) {
    if (!id) return null;
    const s = String(id);
    if (/([._])Cr[a-zA-Z0-9]*$/i.test(s)) return 'correction';
    if (/([._])R[a-zA-Z0-9]*$/i.test(s)) return 'revision';
    return null;
}

/**
 * Returns true when the action string indicates a revision action.
 */
function isRevisionAction(action) {
    return /revision/i.test(String(action || ''));
}

/**
 * Returns true when the action string indicates a correction action.
 */
function isCorrectionAction(action) {
    return /correction/i.test(String(action || ''));
}

/**
 * Returns true when the action string indicates a derived (revision or correction) action.
 */
function isDerivedAction(action) {
    return isRevisionAction(action) || isCorrectionAction(action);
}

module.exports = {
    SUFFIX_RE,
    hasDerivedSuffix,
    stripDerivedSuffix,
    getDerivedType,
    isRevisionAction,
    isCorrectionAction,
    isDerivedAction,
};
