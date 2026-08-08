// Shared definition of the review scoring sections used by the review
// export and by-article review endpoints.

const SECTION1_FIELDS = [
  { field: 'accurately_reflect_manuscript_subject_score', question: 'Does the title accurately reflect the subject of the manuscript?' },
  { field: 'clearly_summarize_content_score', question: 'Does the abstract clearly summarize the content of the manuscript?' },
  { field: 'presents_what_is_known_score', question: 'Does the manuscript present what is already known and unknown (gaps) on the topic in the introduction section?' },
  { field: 'gives_accurate_summary_score', question: 'Does the manuscript give an accurate summary of key recent research on the topic in the introduction section?' },
  { field: 'purpose_clear_score', question: 'Is the purpose (aim or objective) of the paper, its originality and novelty clear as indicated in the introduction section?' },
  { field: 'method_section_clear_score', question: 'Is the methods section of the manuscript clear and what was done clearly and accurately described?' },
  { field: 'study_materials_clearly_described_score', question: 'Are the study materials, methods, instruments used, and measurements made clearly described?' },
  { field: 'research_method_valid_score', question: 'Are the research methods valid, reliable, reproducible, and meet requirements for best practice?' },
  { field: 'ethical_standards_score', question: 'Are ethical standards followed in implementing the research and in writing the manuscript?' },
  { field: 'study_find_clearly_described_score', question: 'What did the study find and has this been clearly described?' },
  { field: 'result_presented_logical_score', question: 'Are the results of the manuscript presented in a logical and coherent manner?' },
  { field: 'graphics_complement_result_score', question: 'Do the graphics used (tables and figures) clearly complement the results?' },
  { field: 'table_follow_specified_standards_score', question: 'Have the tables, graphics, figures, images followed highest specified standards?' },
  { field: 'tables_add_value_or_distract_score', question: 'Do the tables, graphics, figures, images add value or distract from the content of the manuscript?' },
  { field: 'issues_with_title_score', question: 'Are there issues with titles, labels, statistical notation or image quality of tables, graphics, figures, images included in the manuscript?' },
  { field: 'manuscript_present_summary_of_key_findings_score', question: 'Does the manuscript present the summary of the key findings?' },
  { field: 'manuscript_highlight_strength_of_study_score', question: 'Does the manuscript highlight the strengths and limitations of the study?' },
  { field: 'manuscript_compare_findings_score', question: 'Does the manuscript compare its findings to similar papers on the topic?' },
  { field: 'manuscript_discuss_meaning_score', question: 'Does the manuscript discuss the meaning and implications of the findings?' },
  { field: 'manuscript_describes_overall_story_score', question: 'Does the manuscript describe and discuss the overall story formed so far on the topic?' },
  { field: 'conclusions_reflect_achievement_score', question: 'Do the conclusions reflect the achievement of the study aims?' },
  { field: 'manuscript_describe_gaps_score', question: 'Does the manuscript discuss the gaps or inconsistencies on the topic and ways forward described?' },
  { field: 'referencing_accurate_score', question: 'Is the referencing accurate, adequate and balance in relation to the topic of the manuscript?' }
];

const SECTION2_FIELDS = [
  { field: 'novelty_score', question: 'NOVELTY — Does the manuscript address an original and well-defined question? Do the findings advance current knowledge?' },
  { field: 'quality_score', question: 'QUALITY — Does the manuscript adhere to highest standard of writing and presentation?' },
  { field: 'scientific_accuracy_score', question: 'SCIENTIFIC ACCURACY — Was the study design correct and sound? Are methods and analyses appropriate?' },
  { field: 'overall_merit_score', question: 'OVERALL MERIT — Does the manuscript have overall benefit to warrant publication in ASFIRJ?' },
  { field: 'english_level_score', question: 'ENGLISH LEVEL — Is the English language appropriate and understandable?' }
];

const SECTION1_MAX = 115;
const SECTION2_MAX = 25;
const OVERALL_MAX = 140;

module.exports = {
  SECTION1_FIELDS,
  SECTION2_FIELDS,
  SECTION1_MAX,
  SECTION2_MAX,
  OVERALL_MAX
};
