const dbPromise = require("../../../routes/dbPromise.config");

// controllers/editors/getPendingDecisions.js

// Shared SELECT body — the only difference between the primary and fallback
// queries is which column we filter on (email vs. fullname).
const PENDING_DECISIONS_SELECT = `
  SELECT
    s.id,
    s.revision_id,
    s.title,
    s.article_type,
    s.date_submitted,
    s.status,
    i.invitation_status,
    i.invitation_date,
    i.acceptance_date,
    i.invitation_expiry_date,
    i.invited_user,
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

const PRIMARY_QUERY = `
  ${PENDING_DECISIONS_SELECT}
  WHERE (i.invited_user_name = ?
    AND i.invitation_status IN ('pending', 'review_submitted')) OR (i.invited_user = ? AND invited_for = 'To Decide' AND i.invitation_status IN('pending','invite_sent'))
  ORDER BY i.id DESC
`;

const FALLBACK_QUERY = `
  ${PENDING_DECISIONS_SELECT}
  WHERE i.invited_user_name = ?
  ORDER BY i.id DESC
`;

const getPendingDecisions = async (req, res) => {
  try {
    const editorEmail = req.user?.email || "";
    if (!editorEmail) {
      return res.status(401).json({ status: "error", message: "Authentication required" });
    }

    // 1) Confirm the caller is a known editor. Also grab fullname so the
    //    fallback query has something meaningful to match on if needed.
    const [editorRows] = await dbPromise.query(
      "SELECT email, fullname, editorial_level FROM editors WHERE email = ? LIMIT 1",
      [editorEmail]
    );

    if (editorRows.length === 0) {
      return res.status(403).json({ status: "error", message: "Editor account not found" });
    }

    const { fullname: editorFullname } = editorRows[0];

    // 2) Primary: match by invited_user (email).
    const [primaryRows] = await dbPromise.query(PRIMARY_QUERY, [editorEmail, editorEmail]);
    if (primaryRows.length > 0) {
      return res.json({
        status: "success",
        data: primaryRows,
        matchedBy: "email",
      });
    }

    // 3) Fallback: match by invited_user_name. Skip if we have no fullname.
    if (!editorFullname) {
      return res.json({
        status: "success",
        data: [],
        matchedBy: "email",
      });
    }

    const [fallbackRows] = await dbPromise.query(FALLBACK_QUERY, [editorFullname]);

    return res.json({
      status: "success",
      data: fallbackRows,
      matchedBy: fallbackRows.length > 0 ? "fullname" : "none",
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