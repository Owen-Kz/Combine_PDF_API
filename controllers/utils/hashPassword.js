const bcrypt = require('bcrypt');

async function hashPassword(password) {
    const saltRounds = 10; // Adjust the cost factor as needed
    let hashedPassword = await bcrypt.hash(password, saltRounds);

    // Ensure compatibility with PHP bcrypt (convert '$2b$' to '$2y$')
    if (hashedPassword.startsWith('$2b$')) {
        hashedPassword = hashedPassword.replace('$2b$', '$2y$');
    }

    return hashedPassword;
}

module.exports = hashPassword