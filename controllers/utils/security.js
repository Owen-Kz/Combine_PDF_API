// utils/security.js

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} unsafe - Unsafe HTML string
 * @returns {string} - Escaped HTML string
 */
const escapeHtml = (unsafe) => {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Sanitizes input by trimming and escaping HTML
 * @param {string} input - User input string
 * @returns {string} - Sanitized string
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return escapeHtml(input.trim());
};

/**
 * Validates email format
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid email format
 */
const validateEmail = (email) => {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * Encodes string for URL usage
 * @param {string} str - String to encode
 * @returns {string} - URL-encoded string
 */
const urlEncode = (str) => {
  if (typeof str !== 'string') return '';
  return encodeURIComponent(str);
};

/**
 * Sanitizes HTML content while preserving basic formatting
 * @param {string} html - HTML content to sanitize
 * @param {Array} allowedTags - Allowed HTML tags (default: basic formatting tags)
 * @returns {string} - Sanitized HTML
 */
const sanitizeHTML = (html, allowedTags = ['b', 'i', 'u', 'em', 'strong', 'p', 'br', 'a', 'ul', 'ol', 'li']) => {
  if (typeof html !== 'string') return '';
  
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>?/gi;
  return html.replace(tagRegex, (match, tag) => {
    return allowedTags.includes(tag.toLowerCase()) ? match : '';
  });
};

module.exports = {
  escapeHtml,
  sanitizeInput,
  validateEmail,
  urlEncode,
  sanitizeHTML
};