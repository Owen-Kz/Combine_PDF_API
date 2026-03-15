const db = require("../../routes/db.config");

// backend/controllers/reviewer/getReviewDraft.js

const getReviewDraft = async (req, res) => {
    try {
        const userEmail = req.user.email;
        const { manuscriptId } = req.params;

        if (!manuscriptId) {
            return res.status(400).json({ 
                status: "error", 
                message: "Manuscript ID is required" 
            });
        }

        // Get existing review draft
        const [reviews] = await db.promise().query(
            `SELECT * FROM reviews 
             WHERE article_id = ? AND reviewer_email = ? 
             AND (review_status = 'draft' OR review_status = 'in_progress')`,
            [manuscriptId, userEmail]
        );

        if (reviews.length === 0) {
            return res.json({
                status: "success",
                message: "No draft found",
                hasDraft: false
            });
        }

        const review = reviews[0];

        // Format the data to match the form structure
        const formData = {
            paragraph_summary: review.one_paragraph_comment,
            general_comment: review.general_comment,
            specific_comment: review.specific_comment,
            
            // Section 1 scores
            title_accuracy: review.accurately_reflect_manuscript_subject_score,
            abstract_summarize: review.clearly_summarize_content_score,
            man_present: review.presents_what_is_known_score,
            accurate_summary: review.gives_accurate_summary_score,
            paper_purpose: review.purpose_clear_score,
            clear_manuscript: review.method_section_clear_score,
            clear_materials: review.study_materials_clearly_described_score,
            best_practice: review.research_method_valid_score,
            ethical_standards: review.ethical_standards_score,
            study_find: review.study_find_clearly_described_score,
            result_present: review.result_presented_logical_score,
            complemet_result: review.graphics_complement_result_score,
            specified_standard: review.table_follow_specified_standards_score,
            distract_content: review.tables_add_value_or_distract_score,
            man_issues: review.issues_with_title_score,
            key_findings: review.manuscript_present_summary_of_key_findings_score,
            study_strenghts: review.manuscript_highlight_strength_of_study_score,
            compare_manu: review.manuscript_compare_findings_score,
            discuss_manu: review.manuscript_discuss_meaning_score,
            describe_manu: review.manuscript_describes_overall_story_score,
            study_achievement: review.conclusions_reflect_achievement_score,
            topic_gaps: review.manuscript_describe_gaps_score,
            topic_accuracy: review.referencing_accurate_score,
            
            // Section 2 scores
            novelty: review.novelty_score,
            quality: review.quality_score,
            scientific_accuracy: review.scientific_accuracy_score,
            overall_merit: review.overall_merit_score,
            english_level: review.english_level_score,
            
            recommendation: review.overall_recommendation,
            letter_to_editor: review.letter_to_editor
        };

        // Calculate scores
        const section1Fields = [
            'title_accuracy', 'abstract_summarize', 'man_present', 'accurate_summary',
            'paper_purpose', 'clear_manuscript', 'clear_materials', 'best_practice',
            'ethical_standards', 'study_find', 'result_present', 'complemet_result',
            'specified_standard', 'distract_content', 'man_issues', 'key_findings',
            'study_strenghts', 'compare_manu', 'discuss_manu', 'describe_manu',
            'study_achievement', 'topic_gaps', 'topic_accuracy'
        ];
        
        const section2Fields = [
            'novelty', 'quality', 'scientific_accuracy', 'overall_merit', 'english_level'
        ];

        const section1Total = section1Fields.reduce((sum, field) => {
            return sum + (parseInt(formData[field]) || 0);
        }, 0);
        
        const section2Total = section2Fields.reduce((sum, field) => {
            return sum + (parseInt(formData[field]) || 0);
        }, 0);

        return res.json({
            status: "success",
            hasDraft: true,
            formData,
            scores: {
                table1: section1Total,
                table2: section2Total
            },
            files: {
                paragraph_summary_file: review.one_paragraph_file,
                general_comment_file: review.general_comment_file,
                specific_comment_file: review.specific_comment_file
            }
        });

    } catch (error) {
        console.error("Error fetching review draft:", error);
        return res.status(500).json({ 
            status: "error", 
            message: "Internal server error" 
        });
    }
};

module.exports = getReviewDraft;