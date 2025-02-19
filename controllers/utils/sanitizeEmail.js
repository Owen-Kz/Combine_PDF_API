function sanitizeEmail(email) {
    // Trim whitespace from the start and end
    let sanitizedEmail = email.trim();

    // Remove invalid characters (anything except letters, numbers, @, ., -, and _)
    sanitizedEmail = sanitizedEmail.replace(/[^a-zA-Z0-9@._-]/g, '');

    return sanitizedEmail;
}

module.exports = sanitizeEmail