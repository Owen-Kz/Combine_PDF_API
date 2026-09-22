const decodeSanitizeEmail = (encoded) => {
  if (!encoded || typeof encoded !== 'string') return '';

  try {
    // decodeURIComponent handles %40 → @, %2B → +, etc.
    // Replace literal '+' with space first, only if you're dealing with
    // application/x-www-form-urlencoded values (query strings sent as form data).
    // For standard URI-encoded values, '+' is already '%2B', so this line is safe.
    return decodeURIComponent(encoded.replace(/\+/g, ' ')).trim().toLowerCase();
  } catch (e) {
    // Malformed input (e.g. a lone '%') — return as-is so nothing crashes
    console.warn('Failed to decode email:', encoded, e);
    return encoded.trim().toLowerCase();
  }
};

const transformToLowerCase = (str) =>
  typeof str === 'string' ? str.toLowerCase() : str;
module.exports = {decodeSanitizeEmail, transformToLowerCase}