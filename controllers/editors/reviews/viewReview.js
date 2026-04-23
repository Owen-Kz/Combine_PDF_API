// backend/controllers/editors/viewReview.js
const db = require("../../../routes/db.config");

const viewReview = async (req, res) => {
    console.log("REVIEWER STARTED")
    try {
        const { article_id, review_id } = req.body;
        console.log(req.body)
        

        // Validate required parameters
        if (!article_id || !review_id) {
            return res.status(400).json({ 
                error: "Missing parameters", 
                message: "article_id,  and review_id are required" 
            });
        }

        console.log(`Fetching review - Article: ${article_id}, Review ID: ${review_id}`);

        // Query to get the specific review
        const query = `
            SELECT 
                id,
                article_id,
                review_id,
                reviewer_email,
                one_paragraph_comment,
                one_paragraph_file,
                general_comment,
                general_comment_file,
                specific_comment,
                specific_comment_file,
                -- Section 1 scores
                accurately_reflect_manuscript_subject_score,
                clearly_summarize_content_score,
                presents_what_is_known_score,
                gives_accurate_summary_score,
                purpose_clear_score,
                method_section_clear_score,
                study_materials_clearly_described_score,
                research_method_valid_score,
                ethical_standards_score,
                study_find_clearly_described_score,
                result_presented_logical_score,
                graphics_complement_result_score,
                table_follow_specified_standards_score,
                tables_add_value_or_distract_score,
                issues_with_title_score,
                manuscript_present_summary_of_key_findings_score,
                manuscript_highlight_strength_of_study_score,
                manuscript_compare_findings_score,
                manuscript_discuss_meaning_score,
                manuscript_describes_overall_story_score,
                conclusions_reflect_achievement_score,
                manuscript_describe_gaps_score,
                referencing_accurate_score,
                -- Section 2 scores
                novelty_score,
                quality_score,
                scientific_accuracy_score,
                overall_merit_score,
                english_level_score,
                -- Recommendation and comments
                overall_recommendation,
                letter_to_editor,
                review_status,
                date_created,
                date_completed
            FROM reviews 
            WHERE article_id = ? AND review_id = ?
            LIMIT 1
        `;

        db.query(query, [article_id, review_id], (error, results) => {
            if (error) {
                console.error("Database error:", error);
                return res.status(500).json({ 
                    error: "Database error", 
                    message: error.message 
                });
            }

            if (results.length === 0) {
                return res.status(404).json({ 
                    error: "Review not found", 
                    message: "No review found with the provided parameters" 
                });
            }

            const review = results[0];

            // Calculate section totals
            const section1Scores = [
                review.accurately_reflect_manuscript_subject_score,
                review.clearly_summarize_content_score,
                review.presents_what_is_known_score,
                review.gives_accurate_summary_score,
                review.purpose_clear_score,
                review.method_section_clear_score,
                review.study_materials_clearly_described_score,
                review.research_method_valid_score,
                review.ethical_standards_score,
                review.study_find_clearly_described_score,
                review.result_presented_logical_score,
                review.graphics_complement_result_score,
                review.table_follow_specified_standards_score,
                review.tables_add_value_or_distract_score,
                review.issues_with_title_score,
                review.manuscript_present_summary_of_key_findings_score,
                review.manuscript_highlight_strength_of_study_score,
                review.manuscript_compare_findings_score,
                review.manuscript_discuss_meaning_score,
                review.manuscript_describes_overall_story_score,
                review.conclusions_reflect_achievement_score,
                review.manuscript_describe_gaps_score,
                review.referencing_accurate_score
            ];

            const section2Scores = [
                review.novelty_score,
                review.quality_score,
                review.scientific_accuracy_score,
                review.overall_merit_score,
                review.english_level_score
            ];

            const section1Total = section1Scores.reduce((sum, score) => sum + (parseInt(score) || 0), 0);
            const section2Total = section2Scores.reduce((sum, score) => sum + (parseInt(score) || 0), 0);

            // Structure the response
            const formattedReview = {
                id: review.id,
                review_id: review.review_id,
                article_id: review.article_id,
                reviewer_email: review.reviewer_email,
                comments: {
                    one_paragraph: review.one_paragraph_comment,
                    one_paragraph_file: review.one_paragraph_file,
                    general: review.general_comment,
                    general_file: review.general_comment_file,
                    specific: review.specific_comment,
                    specific_file: review.specific_comment_file,
                    confidential: review.letter_to_editor
                },
                scores: {
                    section1: {
                        accurately_reflect_manuscript_subject: review.accurately_reflect_manuscript_subject_score,
                        clearly_summarize_content: review.clearly_summarize_content_score,
                        presents_what_is_known: review.presents_what_is_known_score,
                        gives_accurate_summary: review.gives_accurate_summary_score,
                        purpose_clear: review.purpose_clear_score,
                        method_section_clear: review.method_section_clear_score,
                        study_materials_clearly_described: review.study_materials_clearly_described_score,
                        research_method_valid: review.research_method_valid_score,
                        ethical_standards: review.ethical_standards_score,
                        study_find_clearly_described: review.study_find_clearly_described_score,
                        result_presented_logical: review.result_presented_logical_score,
                        graphics_complement_result: review.graphics_complement_result_score,
                        table_follow_specified_standards: review.table_follow_specified_standards_score,
                        tables_add_value_or_distract: review.tables_add_value_or_distract_score,
                        issues_with_title: review.issues_with_title_score,
                        manuscript_present_summary_of_key_findings: review.manuscript_present_summary_of_key_findings_score,
                        manuscript_highlight_strength_of_study: review.manuscript_highlight_strength_of_study_score,
                        manuscript_compare_findings: review.manuscript_compare_findings_score,
                        manuscript_discuss_meaning: review.manuscript_discuss_meaning_score,
                        manuscript_describes_overall_story: review.manuscript_describes_overall_story_score,
                        conclusions_reflect_achievement: review.conclusions_reflect_achievement_score,
                        manuscript_describe_gaps: review.manuscript_describe_gaps_score,
                        referencing_accurate: review.referencing_accurate_score,
                        total: section1Total,
                        max: 115 // 23 questions * 5
                    },
                    section2: {
                        novelty: review.novelty_score,
                        quality: review.quality_score,
                        scientific_accuracy: review.scientific_accuracy_score,
                        overall_merit: review.overall_merit_score,
                        english_level: review.english_level_score,
                        total: section2Total,
                        max: 25 // 5 questions * 5
                    },
                    overall: {
                        total: section1Total + section2Total,
                        max: 140 // 115 + 25
                    }
                },
                recommendation: review.overall_recommendation,
                status: review.review_status,
                dates: {
                    created: review.date_created,
                    completed: review.date_completed
                }
            };

            return res.json({ 
                success: true, 
                message: "Review retrieved successfully",
                review: formattedReview 
            });

        });

    } catch (error) {
        console.error("Error in viewReview:", error);
        return res.status(500).json({ 
            error: "Server error", 
            message: error.message 
        });
    }
};

module.exports = viewReview;