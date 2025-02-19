import { GetParameters, parentDirectoryName, submissionsEndpoint } from "../constants.js";
import { formatTimestamp } from "../formatDate.js"
import { GetSubmissionData } from "../queries/getSubmissionData.js";
import { GetCookie } from "../setCookie.js"
import { validateLogin } from "../validateLogin.js"
import { getAuthorsDetails } from "./emails/getAuthorsDetails.js";
const userFullnameContainer = document.querySelectorAll(".userFullnameContainer")
const user = GetCookie("editor")
if(user){
const AccountData = await validateLogin(user)
const reviewIdContainer = document.getElementById("reviewIdContainer");
const totalOverallRating = document.getElementById("totalOverallRating")
const totalSpecificScore = document.getElementById("totalSpecificScore")
const one_paragraph_file_container = document.getElementById("one_paragraph_file")
const general_comment_file_container = document.getElementById("general_comment_file")
const speicic_comment_container = document.getElementById("specific_comment_file")
const overallRecommendationContainer = document.getElementById("overallRecommendationContainer")
const accurate_reflect = document.getElementById("accurate_reflect")
const clearly_summarize = document.getElementById("clearly_summarize")
const already_known = document.getElementById("already_known")
const accurate_summary = document.getElementById("accurate_summary")
const originality = document.getElementById("originality")
const letterToEditorContainer = document.getElementById("letter_to_editor")
const ReviewerDetailsContaienr = document.getElementById("reviewerDetails")
const BackButton = document.getElementById("backButton")
const ArticleInfoContainer = document.getElementById("articleInfoContainer")
// const ArticleIdContainer = document.getElementById("articleIdContainer")


const ArticleId = GetParameters(window.location.href).get("a")
BackButton.addEventListener("click", function(){
    window.location.href = `${parentDirectoryName}/view?a=${ArticleId}`
})
const reviewer = GetParameters(window.location.href).get('r')
const getReviewerDetails = await getAuthorsDetails(user, reviewer)
ReviewerDetailsContaienr.innerHTML = `Reviewer's Report <br> by ${getReviewerDetails}`
if(ArticleId && reviewer){
    // Get the Details of the review and display on the page 
    fetch(`/editors/viewReview`,{
        method:"POST",
        headers:{
            "Content-type": "application/JSON"
        },
        body:JSON.stringify({a:ArticleId, r:reviewer})
    }).then(res => res.json())
    .then(async data=>{
        if(data.success){
            const reviewsContent = data.reviewContent[0]
            const oneParagraph = reviewsContent.one_paragraph_comment
            const oneParagraphFile = reviewsContent.one_paragraph_file 
            const generalComment = reviewsContent.general_comment 
            const generalCommentFile = reviewsContent.general_comment_file 

            const specificComment =  reviewsContent.specific_comment
            const specificCommentFile = reviewsContent.specific_comment_file
            const overallRecommendation = reviewsContent.overall_recommendation 
            const letter_to_editor = reviewsContent.letter_to_editor
            const review_status = reviewsContent.review_status
            letterToEditorContainer.innerText = letter_to_editor
            const accurately_reflect_manuscript_subject_score = reviewsContent.accurately_reflect_manuscript_subject_score
            const OverallRating = new Number(reviewsContent.novelty_score) + new Number(reviewsContent.quality_score) + new Number(reviewsContent.scientific_accuracy_score) + new Number(reviewsContent.overall_merit_score) + new Number(reviewsContent.english_level_score)
           
            const SpecificSCore = new Number(reviewsContent.accurately_reflect_manuscript_subject_score) + new Number(reviewsContent.clearly_summarize_content_score) + new Number(reviewsContent.presents_what_is_known_score) + new Number(reviewsContent.gives_accurate_summary_score) + new Number(reviewsContent.purpose_clear_score) + new Number(reviewsContent.method_section_clear_score) + new Number(reviewsContent.study_materials_clearly_described_score) + new Number(reviewsContent.research_method_valid_score) + new Number(reviewsContent.ethical_standards_score) + new Number(reviewsContent.study_find_clearly_described_score) + new Number(reviewsContent.result_presented_logical_score) + new Number(reviewsContent.graphics_complement_result_score) + new Number(reviewsContent.table_follow_specified_standards_score) + new Number(reviewsContent.tables_add_value_or_distract_score) + new Number(reviewsContent.issues_with_title_score) + new Number(reviewsContent.manuscript_present_summary_of_key_findings_score) + new Number(reviewsContent.manuscript_highlight_strength_of_study_score) + new Number(reviewsContent.manuscript_compare_findings_score) + new Number(reviewsContent.manuscript_discuss_meaning_score) + new Number(reviewsContent.manuscript_describes_overall_story_score) + new Number(reviewsContent.conclusions_reflect_achievement_score) + new Number(reviewsContent.manuscript_describe_gaps_score) + new Number(reviewsContent.referencing_accurate_score)
            const reviewId = reviewsContent.review_id

            // Append the values to the DOM 

            // Append the Article's Data to the Dom 
            const ArticleInfo =  await GetSubmissionData(ArticleId)
            const ArtilceTitle = ArticleInfo.title 
            const ArticleIdMain = ArticleInfo.revision_id

            ArticleInfoContainer.innerHTML = `<b>Title: </b> ${ArtilceTitle} (${ArticleIdMain})`
            



            reviewIdContainer.innerText = reviewId
            one_paragraph_comment.innerText = oneParagraph
            if(oneParagraphFile !== "" && oneParagraphFile != ""){
                one_paragraph_file_container.innerHTML += `<a style="color:#333; text-decoration:underline; "href=${submissionsEndpoint}/uploads/reviews/${oneParagraphFile} target=_blank>Open File</a>`
            }else{
                one_paragraph_file_container.innerHTML = `<span>No Files attached</span>`
            }

            if(specificCommentFile !== "" && specificCommentFile !=""){
                speicic_comment_container.innerHTML = `<a style="color:#333; text-decoration:underline; "href=${submissionsEndpoint}/uploads/reviews/${specificCommentFile} target=_blank>Open File</a>`
            }else{
                speicic_comment_container.innerHTML = `<span>No Files attached</span>`

            }

            if(generalCommentFile !== "" && generalCommentFile != ""){
                general_comment_file_container.innerHTML += `<a style="color:#333; text-decoration:underline; "href=${submissionsEndpoint}/uploads/reviews/${generalCommentFile} target=_blank>Open File</a>`
            }else{
                general_comment_file_container.innerHTML = `<span>No Files attached</span>`
            }


            totalOverallRating.innerText = OverallRating
            totalSpecificScore.innerText = SpecificSCore
            accurate_reflect.innerText = `${reviewsContent.accurately_reflect_manuscript_subject_score}/5`
            clearly_summarize.innerText = `${reviewsContent.clearly_summarize_content_score}/5`
            already_known.innerText = `${reviewsContent.presents_what_is_known_score}/5`
            accurate_summary.innerText = `${reviewsContent.gives_accurate_summary_score}/5`
            originality.innerText = `${reviewsContent.novelty_score}/5`
            clear_description.innerText = `${reviewsContent.method_section_clear_score}/5`
            study_materials.innerText  = `${reviewsContent.study_materials_clearly_described_score}/5`
            research_method.innerText = `${reviewsContent.research_method_valid_score}/5`
            ethical_standards.innerText = `${reviewsContent.ethical_standards_score}/5`
            study_find.innerText = `${reviewsContent.study_find_clearly_described_score}`
            manuscript_logical.innerText = `${reviewsContent.result_presented_logical_score}`
            tables_clear.innerText = `${reviewsContent.graphics_complement_result_score}`
            tables_standards.innerText = `${reviewsContent.table_follow_specified_standards_score}`
            tables_distract.innerText =`${reviewsContent.tables_add_value_or_distract_score}`
            tables_issues.innerText = `${reviewsContent.issues_with_title_score}`
            summary_keyfinds.innerText = `${reviewsContent.manuscript_present_summary_of_key_findings_score}`
            manuscript_strength.innerText = `${reviewsContent.manuscript_highlight_strength_of_study_score}`
            compare_findings.innerText = `${reviewsContent.manuscript_compare_findings_score}`
            discuss_meaning.innerText = `${reviewsContent.manuscript_discuss_meaning_score}`
            describe_story.innerText = `${reviewsContent.manuscript_describes_overall_story_score}`
            reflect_achievement.innerText = `${reviewsContent.conclusions_reflect_achievement_score}`
            inconsistency.innerText = `${reviewsContent.manuscript_describe_gaps_score}`
            referencing.innerText = `${reviewsContent.referencing_accurate_score}`
            novelty.innerText = `${reviewsContent.novelty_score}`
            quality.innerText = `${reviewsContent.quality_score}`
            scientific_accuracy.innerText = `${reviewsContent.scientific_accuracy_score}`
            merit.innerText = `${reviewsContent.overall_merit_score}`
            english.innerText = `${reviewsContent.english_level_score}`


            if(overallRecommendation === "Accept As It Is"){
                overallRecommendationContainer.innerHTML = `                        <tr id="queue_0" name="queue_0" role="row" class="odd">         
               <td data-label="status">              
                <b>Accept As It Is </b>
                
                        
                    </td>
    
                                          
                    <td class="whitespace-nowrap" data-label="submitted">
                        <b>The manuscript can be accepted without any further changes.</b>
                    </td>
                    
               </tr>
            
             
                 `
            }else if(overallRecommendation === "Accept Following Minor Revisions"){
                overallRecommendationContainer.innerHTML =`   <tr id="queue_0" name="queue_0" role="row" class="odd">         
                <td data-label="status">              
                         
                    <b>Accept Following Minor Revisions </b>
                         
                     </td>
         
                 
                                           
                     <td class="whitespace-nowrap" data-label="submitted">
                         <b>The paper can be accepted after satisfactory minor revisions on the basis of the comments raised by the reviewers and the editor.</b>
                     </td>
                     
                </tr>`
            }else if(overallRecommendation === "Reject"){
                overallRecommendationContainer.innerHTML = `   <tr id="queue_0" name="queue_0" role="row" class="odd">         
                        <td data-label="status">              
                                 
                            <b>Reject</b>
                                 
                             </td>
                 
                         
                                                   
                             <td class="whitespace-nowrap" data-label="submitted">
                                <b>The manuscript is considered to contain serious flaws and does offer any original contribution to the topic area.</b>
                             </td>
                             
                        </tr>`
            }
            else if(overallRecommendation == "Reconsider Following Major Revisions"){
                overallRecommendationContainer.innerHTML =`   <tr id="queue_0" name="queue_0" role="row" class="odd">         
                    <td data-label="status">              
                             
                        <b>Reconsider Following Major Revisions</b>
                             
                         </td>
             
                      
                                               
                         <td class="whitespace-nowrap" data-label="submitted">
                            <b>The manuscript can be accepted after satisfactory major revisions on the basis of the comments raised by the reviewers and the editor.</b>
                         </td>
                         
                    </tr>`
            }
    

        }else{
        
            alert(data.message)
            // window.location.href = `${parentDirectoryName}/Dashboard`
        }


    })
  
}else{
window.location.href = `${parentDirectoryName}/view?a=${ArticleId}`
}

}else{
   window.location.href = `${parentDirectoryName}/view?a=${ArticleId}`
}
