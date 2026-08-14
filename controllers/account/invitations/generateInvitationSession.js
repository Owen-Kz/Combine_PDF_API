// controllers/account/invitations/generateInvitationSession.js
const jwt = require("jsonwebtoken");
const writeCookie = require("../../utils/writeCookie");

/**
 * Builds a login session for a user who just accepted an invitation:
 * a JWT (same payload as the authors login), session records, cookies,
 * and the user object the React portal stores in localStorage.
 *
 * All side effects are guarded so it also works when called with the
 * fake req/res objects used by the create-account controllers.
 *
 * @param {Object} req - Express request (may be a minimal fake)
 * @param {Object} res - Express response (may be a minimal fake)
 * @param {Object} user - authors_account row
 * @param {Function} query - promise-style query fn (mysql2: (sql, params) => [rows])
 * @returns {Promise<{ token: string, user: Object }>}
 */
const generateInvitationSession = async (req, res, user, query) => {
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.is_editor === "yes" ? "editor" : "author",
      firstName: user.firstname,
      lastName: user.lastname,
      prefix: user.prefix || null,
      orcidId: user.orcid_id || null,
      discipline: user.discipline || null,
      affiliations: user.affiliations || user.affiliation || null,
      affiliationCountry: user.affiliation_country || null,
      affiliationCity: user.affiliation_city || null,
      asfiMembershipId: user.asfi_membership_id || null,
      isReviewer: user.is_reviewer || "no",
      isEditor: user.is_editor || "no",
      accountStatus: user.account_status || "active",
      dateJoined: user.date_joined || null
    },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: process.env.JWT_EXPIRES || "7d" }
  );

  const ip_add =
    (req && req.headers && req.headers["x-forwarded-for"]) ||
    (req && req.connection && req.connection.remoteAddress) ||
    "unknown";
  const userAgent = (req && req.headers && req.headers["user-agent"]) || "unknown";

  let editorData = [];
  let editorialLevel = "N/A";
  let editorialSection = null;

  try {
    if (user.is_editor === "yes" && typeof query === "function") {
      const [rows] = await query("SELECT * FROM editors WHERE email = ?", [user.email]);
      editorData = rows || [];
      if (editorData.length > 0) {
        editorialLevel = editorData[0].editorial_level || "sectional_editor";
        editorialSection = editorData[0].editorial_section || null;
        await query(
          `INSERT IGNORE INTO editors_session
            (editor_id, session_token, ip_address, user_agent, created_at, expires_at)
           VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))
           ON DUPLICATE KEY UPDATE session_token = VALUES(session_token),
             ip_address = VALUES(ip_address), user_agent = VALUES(user_agent),
             expires_at = VALUES(expires_at)`,
          [editorData[0].id, token, ip_add, userAgent]
        );
      }
    }

    if (typeof query === "function") {
      const [authorRows] = await query(
        "SELECT id FROM authors_account WHERE email = ? LIMIT 1",
        [user.email]
      );
      if (authorRows.length > 0) {
        await query(
          `INSERT IGNORE INTO authors_session
            (user_id, session_token, ip_address, user_agent, created_at, expires_at)
           VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))
           ON DUPLICATE KEY UPDATE session_token = VALUES(session_token),
             ip_address = VALUES(ip_address), user_agent = VALUES(user_agent),
             expires_at = VALUES(expires_at)`,
          [authorRows[0].id, token, ip_add, userAgent]
        );
      }
    }
  } catch (err) {
    // Session/cookie failures must never block the acceptance itself
    console.error("Error creating invitation session records:", err.message);
  }

  try {
    if (res && typeof res.cookie === "function") {
      writeCookie(req, res, "asfirj_userRegistered", token);
      writeCookie(req, res, "author", user.id);
    }
  } catch (err) {
    console.error("Error writing invitation session cookies:", err.message);
  }

  const isAdmin = editorialLevel === "admin" || editorialLevel === "administrator";
  const isEditorInChief = editorialLevel === "editor-in-chief" || editorialLevel === "editor_in_chief";
  const isAssociateEditor = editorialLevel === "associate_editor" || editorialLevel === "associate-editor";
  const isEditorialAssistant = editorialLevel === "editorial_assistant" || editorialLevel === "editorial-assistant";

  const userData = {
    id: user.id,
    email: user.email,
    firstName: user.firstname,
    lastName: user.lastname,
    fullname: `${user.prefix ? user.prefix + " " : ""}${user.firstname} ${user.lastname}`.trim(),
    role: user.is_editor === "yes" ? "editor" : "author",
    editorialLevel: editorialLevel,
    editorialSection: editorialSection,
    isAdmin: isAdmin,
    isEditorInChief: isEditorInChief,
    isAssociateEditor: isAssociateEditor,
    isEditorialAssistant: isEditorialAssistant,
    prefix: user.prefix || null,
    orcidId: user.orcid_id || null,
    discipline: user.discipline || null,
    affiliations: user.affiliations || null,
    affiliationCountry: user.affiliation_country || null,
    affiliationCity: user.affiliation_city || null,
    asfiMembershipId: user.asfi_membership_id || null,
    canAccessAuthor: true,
    canAccessReviewer: user.is_reviewer === "yes",
    canAccessEditor: user.is_editor === "yes",
    canAccessAdmin: isAdmin || isEditorInChief,
    isReviewer: user.is_reviewer === "yes",
    isEditor: user.is_editor === "yes",
    accountStatus: user.account_status || "active"
  };

  return { token, user: userData };
};

module.exports = generateInvitationSession;
