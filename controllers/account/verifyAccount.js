const db = require("../../routes/db.config");



// Verify Author Account
const verifyAccount = async (req, res) => {
    const emailHash = req.query.e;

    if (!emailHash) {
        return res.render("verify", { error:"Verification Failed",message: "Invalid request", status:"error"  });
    }

    try {
        // Check if user exists
        db.query("SELECT * FROM authors_account WHERE md5(email) = ?", [emailHash], (err, result) => {
            if (err) {
                console.error("Database error:", err);
                return res.render("verify", { error:"Verification Failed", message: "Database query failed", status:"error"  });
            }

            if (result.length > 0) {
                const accountStatus = result[0].account_status;

                if (accountStatus === "verified") {
                    return res.render("verify", {  message: "Account already verified, Proceed to login", success:"account Verififed",status:"success" });
                } else {
                    // Update account status to 'verified'
                    db.query("UPDATE authors_account SET account_status = 'verified' WHERE MD5(email) = ?", [emailHash], (updateErr, updateResult) => {
                        if (updateErr) {
                            console.error("Update error:", updateErr);
                            return res.render("verify", { error:"Verification Failed", message: "Failed to update account", status:"error"  });
                        }
                        return res.render("verify", { success:"Account Verified", message: "Account verified successfully", status:"success"  });
                    });
                }
            } else {
                return res.render("verify", { error:"Verification Failed", message: "User does not exist", status:"error"  });
            }
        });
    } catch (error) {
        console.error("Unexpected error:", error);
        return res.render("verify", { error:"Verification Failed", message: "Internal server error", status:"error"  });
    }
};

module.exports = verifyAccount;
