// backend/controllers/reviewer/submitReview.js
const db = require('../../routes/db.config');
const { notifyEditorForDecision } = require('../editors/decisions/inviteEditorForDecision');

const submitReview = async (req, res) => {
  try {
    const userEmail = req.user.email;
    const {
      manuscriptId,
      paragraph_summary,
      general_comment,
      specific_comment,
      letter_to_editor,
      recommendation,
      action,

      // URLs from the upload endpoint (already absolute, e.g. https://.../review-files/...)
      paragraph_summary_file,
      general_comment_file,
      specific_comment_file,

      // Section 1 scores
      title_accuracy, abstract_summarize,
      man_present, accurate_summary, paper_purpose,
      clear_manuscript, clear_materials, best_practice, ethical_standards,
      study_find, result_present, complemet_result, specified_standard, distract_content, man_issues,
      key_findings, study_strenghts, compare_manu, discuss_manu, describe_manu,
      study_achievement, topic_gaps, topic_accuracy,

      // Section 2 scores
      novelty, quality, scientific_accuracy, overall_merit, english_level,
    } = req.body;

    if (!manuscriptId) {
      return res.status(400).json({ status: 'error', message: 'Manuscript ID is required' });
    }

    // Reuse existing review_id if present
    const [existingReview] = await db.promise().query(
      `SELECT id, review_id FROM reviews WHERE article_id = ? AND reviewer_email = ?`,
      [manuscriptId, userEmail]
    );

    const reviewId = existingReview.length > 0
      ? existingReview[0].review_id
      : `REV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Persist URLs directly. Empty strings become null so we don't overwrite with ''.
    const normalize = (v) => (v && String(v).trim() !== '' ? v : null);

    const reviewData = {
      article_id: manuscriptId,
      review_id: reviewId,
      reviewer_email: userEmail,

      one_paragraph_comment: paragraph_summary || null,
      one_paragraph_file: normalize(paragraph_summary_file),
      general_comment: general_comment || null,
      general_comment_file: normalize(general_comment_file),
      specific_comment: specific_comment || null,
      specific_comment_file: normalize(specific_comment_file),

      // Section 1 scores
      accurately_reflect_manuscript_subject_score: title_accuracy || 0,
      clearly_summarize_content_score: abstract_summarize || 0,
      presents_what_is_known_score: man_present || 0,
      gives_accurate_summary_score: accurate_summary || 0,
      purpose_clear_score: paper_purpose || 0,
      method_section_clear_score: clear_manuscript || 0,
      study_materials_clearly_described_score: clear_materials || 0,
      research_method_valid_score: best_practice || 0,
      ethical_standards_score: ethical_standards || 0,
      study_find_clearly_described_score: study_find || 0,
      result_presented_logical_score: result_present || 0,
      graphics_complement_result_score: complemet_result || 0,
      table_follow_specified_standards_score: specified_standard || 0,
      tables_add_value_or_distract_score: distract_content || 0,
      issues_with_title_score: man_issues || 0,
      manuscript_present_summary_of_key_findings_score: key_findings || 0,
      manuscript_highlight_strength_of_study_score: study_strenghts || 0,
      manuscript_compare_findings_score: compare_manu || 0,
      manuscript_discuss_meaning_score: discuss_manu || 0,
      manuscript_describes_overall_story_score: describe_manu || 0,
      conclusions_reflect_achievement_score: study_achievement || 0,
      manuscript_describe_gaps_score: topic_gaps || 0,
      referencing_accurate_score: topic_accuracy || 0,

      // Section 2 scores
      novelty_score: novelty || 0,
      quality_score: quality || 0,
      scientific_accuracy_score: scientific_accuracy || 0,
      overall_merit_score: overall_merit || 0,
      english_level_score: english_level || 0,

      overall_recommendation: recommendation || null,
      letter_to_editor: letter_to_editor || null,
      review_status: action === 'submit' ? 'review_submitted' : 'draft',
    };

    const updateInvitationsStatus = async (status, manuscriptId, userEmail) => {
      await db.promise().query(
        `UPDATE invitations
         SET invitation_status = ?
         WHERE invitation_link = ? AND invited_user = ? AND invited_for = 'Submission Review'
           AND invitation_status NOT IN ('expired', 'canceled', 'rejected')`,
        [status, manuscriptId, userEmail]
      );
    };

    if (existingReview.length > 0) {
      await db.promise().query(
        `UPDATE reviews SET ? WHERE article_id = ? AND reviewer_email = ?`,
        [reviewData, manuscriptId, userEmail]
      );
      await updateInvitationsStatus('review_saved', manuscriptId, userEmail);
    } else {
      await db.promise().query(`INSERT INTO reviews SET ?`, [reviewData]);
      await updateInvitationsStatus('review_saved', manuscriptId, userEmail);
    }

    let editorInvited = false;
    if (action === 'submit') {
      await db.promise().query(
        `UPDATE invitations SET invitation_status = 'completed'
         WHERE invitation_link = ? AND invited_user = ?`,
        [manuscriptId, userEmail]
      );
      await updateInvitationsStatus('review_submitted', manuscriptId, userEmail);

      try {
        const notifyResult = await notifyEditorForDecision({
          articleId: manuscriptId,
          invitedByEmail: userEmail,
        });
        editorInvited = notifyResult.invited;
      } catch (notifyError) {
        console.error('Error notifying editor for decision:', notifyError);
      }
    }

    return res.json({
      status: 'success',
      message: action === 'submit' ? 'Review submitted successfully' : 'Review saved as draft',
      reviewId,
      editorInvited,
      data: reviewData,
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
};

module.exports = submitReview;