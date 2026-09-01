// controllers/account/invitations/editorialAssistant/createEditorialAssistantAccount.js
// Public: creates an authors_account + editors record (editorial_level =
// 'editorial_assistant') for a brand-new invitee and then accepts the
// invitation so they land logged in on the editorial dashboard.
const bcrypt = require("bcryptjs");
const dbPromise = require("../../../../routes/dbPromise.config");
const acceptEditorialAssistantInvite = require("./acceptEditorialAssistantInvite");

const createEditorialAssistantAccount = async (req, res) => {
  let connection;
  try {
    const {
      prefix,
      firstName,
      lastName,
      otherName,
      email,
      orcid,
      affiliation,
      affiliationCountry,
      affiliationCity,
      discipline,
      otherDiscipline,
      password,
      token
    } = req.body;

    const missingFields = [];
    if (!email) missingFields.push("email");
    if (!password) missingFields.push("password");
    if (!firstName) missingFields.push("firstName");
    if (!lastName) missingFields.push("lastName");
    if (!token) missingFields.push("token");

    if (missingFields.length > 0) {
      return res.status(400).json({
        status: "error",
        message: `Missing required fields: ${missingFields.join(", ")}`
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ status: "error", message: "Invalid email format" });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 8 characters long"
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({
        status: "error",
        message: "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      });
    }

    connection = await dbPromise.getConnection();
    await connection.beginTransaction();

    const [existingUser] = await connection.query(
      "SELECT email, is_editor FROM authors_account WHERE email = ?",
      [email]
    );

    if (existingUser.length > 0 && (existingUser[0].is_editor === "yes" || existingUser[0].is_editor === "1")) {
      await connection.rollback();
      return res.status(409).json({
        status: "error",
        message: "An editor account with this email already exists. Please log in instead."
      });
    }

    const finalDiscipline =
      discipline === "Other" && otherDiscipline ? otherDiscipline : discipline || "";

    const hashedPassword = await bcrypt.hash(password, 10);

    const fullName = [prefix, firstName, lastName, otherName]
      .filter((part) => part && part.trim())
      .join(" ")
      .trim();

    if (existingUser.length === 0) {
      await connection.query(
        `INSERT INTO authors_account
         (prefix, email, orcid_id, discipline, firstname, lastname, othername,
          affiliations, affiliation_country, affiliation_city, is_available_for_review,
          is_editor, editor_invite_status, account_status, password, is_reviewer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prefix || "",
          email,
          orcid || "",
          finalDiscipline,
          firstName,
          lastName,
          otherName || "",
          affiliation || "",
          affiliationCountry || "",
          affiliationCity || "",
          "no",
          "yes",
          "accepted",
          "verified",
          hashedPassword,
          "no"
        ]
      );
    } else {
      await connection.query(
        `UPDATE authors_account
         SET is_editor = 'yes', editor_invite_status = 'accepted', account_status = 'verified',
             is_available_for_review = 'no'
         WHERE email = ?`,
        [email]
      );
    }

    const [editorRows] = await connection.query(
      "SELECT email FROM editors WHERE email = ?",
      [email]
    );

    if (editorRows.length === 0) {
      await connection.query(
        `INSERT INTO editors (email, fullname, editorial_level, editorial_section, password, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [email, fullName || email, "editorial_assistant", finalDiscipline, hashedPassword]
      );
    }

    await connection.commit();

    const acceptReq = { body: { email, token }, headers: req.headers || {}, connection: { remoteAddress: "" } };
    let acceptResponse = null;
    const acceptRes = {
      status: (code) => ({
        json: (data) => {
          acceptResponse = { statusCode: code, data };
          return acceptRes;
        }
      }),
      json: (data) => {
        acceptResponse = { data };
        return acceptRes;
      },
      cookie: () => acceptRes
    };

    await acceptEditorialAssistantInvite(acceptReq, acceptRes);

    if (acceptResponse && acceptResponse.data && (acceptResponse.data.status === "success" || acceptResponse.data.status === "info")) {
      return res.json({
        status: "success",
        message: "Account created and editorial assistant invitation accepted successfully",
        data: {
          email,
          token: acceptResponse.data.token || null,
          user: acceptResponse.data.user || null,
          redirectTo: acceptResponse.data.redirectTo || "/editors/dashboard"
        }
      });
    }

    return res.status(207).json({
      status: "partial_success",
      message: "Account created but invitation acceptance failed. Please try accepting the invitation again.",
      data: { email, requiresRetry: true }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error creating editorial assistant account:", error);
    return res.status(500).json({
      status: "error",
      message: process.env.NODE_ENV === "development" ? error.message : "Failed to create account"
    });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = createEditorialAssistantAccount;