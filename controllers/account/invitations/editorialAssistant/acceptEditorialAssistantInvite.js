// controllers/account/invitations/editorialAssistant/acceptEditorialAssistantInvite.js
// Public: accepts an editorial-assistant invitation for an invitee who already
// has an authors_account (promotes them to editor). Brand-new invitees are
// directed to create an account first.
const dbPromise = require("../../../../routes/dbPromise.config");
const { sendEditorWelcomeEmail } = require("../../../utils/sendWelcomeEmail");
const generateInvitationSession = require("../generateInvitationSession");

const INVITED_FOR = "editorial_assistant";

const assertInvitationValid = async (email, token) => {
  const [invitations] = await dbPromise.query(
    `SELECT invitation_status, invitation_expiry_date FROM invitations
     WHERE invitation_link = ? AND invited_user = ? AND invited_for = ?`,
    [token, email, INVITED_FOR]
  );

  if (invitations.length === 0) {
    return { error: { status: 404, message: "Invitation not found" } };
  }

  const invitation = invitations[0];

  if (invitation.invitation_status === "accepted") {
    return { error: { status: 400, message: "You have already accepted this invitation" } };
  }

  if (invitation.invitation_status === "rejected") {
    return { error: { status: 400, message: "This invitation was previously declined" } };
  }

  const now = new Date();
  const expiry = invitation.invitation_expiry_date
    ? new Date(`${invitation.invitation_expiry_date}T23:59:59`)
    : null;

  if (expiry && expiry < now) {
    return { error: { status: 400, message: "This invitation has expired" } };
  }

  return { invitation };
};

const acceptEditorialAssistantInvite = async (req, res) => {
  let connection;
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({ status: "error", message: "Missing required fields" });
    }

    const check = await assertInvitationValid(email, token);
    if (check.error) {
      return res.status(check.error.status).json({ status: "error", message: check.error.message });
    }

    connection = await dbPromise.getConnection();
    await connection.beginTransaction();

    const [userRows] = await connection.query(
      "SELECT * FROM authors_account WHERE email = ?",
      [email]
    );

    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(200).json({
        status: "info",
        message: "Please create an account first",
        requiresAccount: true,
        email,
        token
      });
    }

    const user = userRows[0];
    const isAlreadyEditor = user.is_editor === "yes" || user.is_editor === "1";

    if (isAlreadyEditor) {
      await connection.rollback();
      return res.status(409).json({
        status: "error",
        message: "This account is already an editor. Please log in instead."
      });
    }

    await connection.query(
      `UPDATE authors_account
       SET is_editor = 'yes', editor_invite_status = 'accepted'
       WHERE email = ?`,
      [email]
    );

    const [editorRows] = await connection.query(
      "SELECT email FROM editors WHERE email = ?",
      [email]
    );

    if (editorRows.length === 0) {
      const fullname = [user.prefix, user.firstname, user.lastname, user.othername]
        .filter((part) => part && part.trim())
        .join(" ")
        .trim();

      await connection.query(
        `INSERT INTO editors (email, fullname, editorial_level, editorial_section, password, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [email, fullname, "editorial_assistant", user.discipline || "", user.password]
      );
    } else {
      await connection.query(
        "UPDATE editors SET editorial_level = 'editorial_assistant', status = 'active' WHERE email = ?",
        [email]
      );
    }

    await connection.query(
      `UPDATE invitations SET invitation_status = 'accepted', acceptance_date = NOW()
       WHERE invitation_link = ? AND invited_user = ? AND invited_for = ?`,
      [token, email, INVITED_FOR]
    );

    await connection.commit();

    const [updatedUser] = await connection.query(
      "SELECT * FROM authors_account WHERE email = ?",
      [email]
    );
    const editorRow = updatedUser[0] || user;

    const { token: sessionToken, user: sessionUser } = await generateInvitationSession(
      req,
      res,
      editorRow,
      (sql, params) => connection.query(sql, params)
    );

    sendEditorWelcomeEmail({
      email: editorRow.email,
      firstName: editorRow.firstname || "",
      lastName: editorRow.lastname || ""
    }).catch((err) => console.error("Failed to send editor welcome email:", err.message));

    return res.json({
      status: "success",
      message: "Invitation accepted successfully",
      token: sessionToken,
      user: sessionUser,
      redirectTo: "/editors/dashboard"
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error accepting editorial assistant invitation:", error);
    return res.status(500).json({
      status: "error",
      message: process.env.NODE_ENV === "development" ? error.message : "Failed to accept invitation"
    });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = acceptEditorialAssistantInvite;