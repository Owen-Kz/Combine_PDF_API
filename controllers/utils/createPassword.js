const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Generate a random 8-byte (16-character) hexadecimal password

const CreatePassword = async (generatedPassword) =>{
// const generatedPassword = crypto.randomBytes(8).toString('hex');

// Encrypt the password using bcrypt
const saltRounds = 10;
bcrypt.hash(generatedPassword, saltRounds, (err, encryptedPassword) => {
    if (err) {
        console.error('Error hashing password:', err);
        return generatedPassword
    } else {
        console.log('Generated Password:', generatedPassword);
        console.log('Encrypted Password:', encryptedPassword);
        return encryptedPassword
    }
});

}

module.exports = CreatePassword