const axios = require("axios")
// Verify reCAPTCHA token
const verifyRecaptcha = async (token) => {
    console.log("Verifying reCAPTCHA token:", token ? "Token present" : "No token");
    
    try {
        // Test secret key for development (always returns success)
        const TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';
        
        // Use environment variable or fallback to test key
        const secretKey = process.env.RECAPTCHA_SECRET_KEY || TEST_SECRET_KEY;
        
        console.log("Using reCAPTCHA secret key:", secretKey === TEST_SECRET_KEY ? "Test key" : "Production key");
        
        const response = await axios.post(
            'https://www.google.com/recaptcha/api/siteverify',
            null,
            {
                params: {
                    secret: secretKey,
                    response: token
                }
            }
        );
        
        console.log("reCAPTCHA API response:", response.data);
        
        // Check if verification was successful
        if (response.data.success) {
            return true;
        } else {
            // Log error codes for debugging
            console.error("reCAPTCHA verification failed with errors:", response.data['error-codes']);
            return false;
        }
    } catch (error) {
        console.error("reCAPTCHA verification error:", error.message);
        if (error.response) {
            console.error("reCAPTCHA error response:", error.response.data);
        }
        return false;
    }
};


module.exports = verifyRecaptcha