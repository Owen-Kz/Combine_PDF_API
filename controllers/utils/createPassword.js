const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Generate a random 8-byte (16-character) hexadecimal password

const CreatePassword = async (generatedPassword) =>{
// const generatedPassword = crypto.randomBytes(8).toString('hex');
return new Promise((resolve, reject) =>{

// Encrypt the password using bcrypt
const saltRounds = 10;
bcrypt.hash(generatedPassword, saltRounds, (err, encryptedPassword) => {
    if (err) {
        console.error('Error hashing password:', err);
        resolve(generatedPassword)
    } else {
        // console.log('Generated Password:', generatedPassword);
        // console.log('Encrypted Password:', encryptedPassword);
        resolve(encryptedPassword)
    }
});
})
}
(async () => {
  try {
    const password = await CreatePassword("6e6a0052ad91b565");
    // console.log(password);
  } catch (error) {
    console.error("Error:", error);
  }
})();

module.exports = CreatePassword