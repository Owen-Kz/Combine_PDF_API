const {randomBytes} = requie("crypto")
 const generateRandomToken = (byteLength = 24) =>
  randomBytes(byteLength).toString('base64url');

module.exports = generateRandomToken