// controllers/editors/getPendingDecisions.js
const dbPromise = require("../../../routes/dbPromise.config");
const isAdminAccount = require("../isAdminAccount");

// Shared SELECT body — reused by every variant of the query below.
const PENDING_DECISIONS_SELECT = `
  SELECT
    s.id,
    s.revision_id,
    s.title,
    s.article_type,
    s.corresponding_authors_email,
    s.date_submitted,
    s.status,
    i.invitation_status,
    i.invitation_date,
    i.acceptance_date,
    i.invitation_expiry_date,
    i.invited_user,
    i.invited_for,
    i.decision_viewed,
    (SELECT COUNT(*) FROM reviews r
      WHERE r.article_id = s.revision_id
        AND r.review_status = 'review_submitted') AS reviews_count,
    (SELECT COUNT(*) FROM invitations inv
      WHERE inv.invitation_link = s.revision_id
        AND inv.invited_for = 'Submission Review'
        AND inv.invitation_status IN ('accepted','completed','review_saved','review_submitted')) AS expected_reviews
  FROM invitations i
  INNER JOIN submissions s
    ON s.revision_id = i.invitation_link
   AND s.id = (SELECT MIN(id) FROM submissions WHERE revision_id = i.invitation_link)
`;

// Pick a single row per invitation_link. Priority:
//   1. 'To Decide' pending/invite_sent  (the actionable one for the editor)
//   2. anything else (e.g. review_submitted) as a fallback
// MySQL 8+ supports ROW_NUMBER(); if you're on 5.7 see the alternative below.
const DEDUPE_WRAPPER = (innerSql) => `
  SELECT * FROM (
    SELECT
      inner_q.*,
      ROW_NUMBER() OVER (
        PARTITION BY inner_q.revision_id
        ORDER BY
          CASE
            WHEN inner_q.invited_for = 'To Decide'
             AND inner_q.invitation_status IN ('pending','invite_sent') THEN 0
            WHEN inner_q.invitation_status = 'review_submitted' THEN 1
            ELSE 2
          END,
          inner_q.id DESC
      ) AS rn
    FROM (${innerSql}) AS inner_q
  ) AS ranked
  WHERE rn = 1
  ORDER BY id DESC
`;

// Admin: all pending decisions + all completed reviews across the platform.
const ADMIN_QUERY = DEDUPE_WRAPPER(`
  ${PENDING_DECISIONS_SELECT}
  WHERE (i.invited_for = 'To Decide'
         AND i.invitation_status IN ('pending', 'invite_sent'))
     OR (i.invitation_status IN ('review_submitted'))
`);

// Non-admin primary: the current user's own actionable "To Decide" invitations.
const PRIMARY_QUERY = DEDUPE_WRAPPER(`
  ${PENDING_DECISIONS_SELECT}
  WHERE i.invited_user = ?
    AND i.invited_for = 'To Decide'
    AND i.invitation_status IN ('pending', 'invite_sent')
`);

// Non-admin fallback: name-based match for the case where invited_user was blank.
const FALLBACK_QUERY = DEDUPE_WRAPPER(`
  ${PENDING_DECISIONS_SELECT}
  WHERE i.invited_user_name = ?
    AND (
      (i.invited_for = 'To Decide' AND i.invitation_status IN ('pending','invite_sent'))
      OR i.invitation_status = 'review_submitted'
    )
`);

const getPendingDecisions = async (req, res) => {
  try {
    const editorEmail = req.user?.email || "";

    if (!editorEmail) {
      return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    // 1) Confirm the caller is a known editor. Also grab fullname for the
    //    non-admin fallback path.
    const [editorRows] = await dbPromise.query(
      "SELECT email, fullname, editorial_level FROM editors WHERE email = ? LIMIT 1",
      [editorEmail]
    );

    if (editorRows.length === 0) {
      return res.status(403).json({ status: "error", message: "Editor account not found" });
    }

    const { fullname: editorFullname } = editorRows[0];

    // 2) Determine admin status. Handle sync or async isAdminAccount.
    let isAdmin = false;
    try {
      isAdmin = await Promise.resolve(isAdminAccount(req.user?.id));
    } catch (adminCheckError) {
      console.error("Admin check failed, defaulting to non-admin:", adminCheckError);
      isAdmin = false;
    }

    // 3) Admin path — everything, deduped per manuscript.
    if (isAdmin) {
      const [adminRows] = await dbPromise.query(ADMIN_QUERY);
      return res.json({
        status: "success",
        data: adminRows,
        matchedBy: "admin",
        isAdmin: true,
      });
    }

    // 4) Non-admin primary — match by invited_user (email).
    const [primaryRows] = await dbPromise.query(PRIMARY_QUERY, [editorEmail]);
    if (primaryRows.length > 0) {
      return res.json({
        status: "success",
        data: primaryRows,
        matchedBy: "email",
        isAdmin: false,
      });
    }

    // 5) Non-admin fallback — match by invited_user_name.
    if (!editorFullname) {
      return res.json({
        status: "success",
        data: [],
        matchedBy: "none",
        isAdmin: false,
      });
    }

    const [fallbackRows] = await dbPromise.query(FALLBACK_QUERY, [editorFullname]);

    return res.json({
      status: "success",
      data: fallbackRows,
      matchedBy: fallbackRows.length > 0 ? "fullname" : "none",
      isAdmin: false,
    });
  } catch (error) {
    console.error("Error fetching pending decisions:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

module.exports = getPendingDecisions;