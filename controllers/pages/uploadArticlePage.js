const session = require("express-session");
const findManuscript = require("../utils/findManuscript");
const findKeywords = require("../utils/findKeywords");
const findAuthors = require("../utils/findAuthors");
const findReviewers = require("../utils/findReviewers");
const db = require("../../routes/db.config");
const findRevisionId = require("../utils/findRevisionId");
const generateArticleId = require("../generateArticleId");

const uploadArticlePage = async (req, res) => {
    try {
        // Get user data
        const prefix = req.user.prefix;
        const firstname = req.user.firstname;
        const lastname = req.user.lastname;
        const othername = req.user.othername;
        const orcid = req.user.orcid_id;
        const email = req.user.email;
        const discipline = req.user.discipline;
        const affiliation = req.user.affiliations;
        const affiliation_country = req.user.affiliation_country;
        const affiliation_city = req.user.affiliation_city;
        const asfi_membership_id = req.user.asfi_membership_id;

        let correction = false, edit = false, revision = false;
        let currentSubmissionProcess = "new";
        let queriedID = "";
        if(req.query.a) {
            queriedID = `a=${req.query.a}`;
        }
        if(req.query.correct) correction = true, currentSubmissionProcess = "correction";
        else if(req.query.edit) edit = true, currentSubmissionProcess = "edit";
        else if(req.query.revision || req.query.revise) revision = true, currentSubmissionProcess = "revision";

        // Initialize session if not exists
        if (!req.session.manuscriptData) {
            req.session.manuscriptData = {};
        }

        let ArticleId = req.session.articleId;
        let currentProcess = req.current_process || "saved_for_later";
     

        // If we have article data from middleware, use it
        if (req.session.article_data) {
            const articleData = req.session.article_data;
            
            return res.render("uploadPage", {
                articleId: articleData.revision_id,
                article_id: articleData.article_id,
                firstname, lastname, othername, prefix,
                affiliation, affiliation_country, affiliation_city,
                orcid, asfi_membership_id,
                email, discipline,
                SavedAbstract: articleData.abstract,
                title: articleData.title,
                article_discipline: articleData.discipline,
                article_type: articleData.article_type,
                manuscript_file: articleData.manuscript_file,
                tracked_manuscript_file: articleData.tracked_manuscript_file,
                coverLetter: articleData.cover_letter_file,
                tables: articleData.tables,
                figures: articleData.figures,
                graphic_abstract: articleData.graphic_abstract,
                supplementaryMaterials: articleData.supplementary_material || "not-found",
                correspondingAuthor: articleData.corresponding_authors_email,
                previousId: articleData.article_id,
                status: articleData.status,
                Keywords: req.keywords || [],
                Authors: req.submissionAuthors || [],
                is_women_in_contemporary: articleData.is_women_in_contemporary_science || "no",
                suggestedReviewers: req.suggested_reviewers || [],
                currentProcess: currentProcess,
                _uid_token: req.query._uid,
                correction,
                edit,
                revision,
                currentSubmissionProcess,
                queriedID
            });
        }
        
        // For new submissions or cases where middleware didn't set article_data
        // Generate article ID if not exists
        if (!ArticleId) {
            ArticleId = await generateArticleId(req, res);
            req.session.articleId = ArticleId;
            req.session.manuscriptData.sessionID = ArticleId;
        }

        // Render plain page for new submissions
        return res.render("uploadPage", {
            articleId: ArticleId,
            article_id: ArticleId,
            firstname, lastname, othername, prefix,
            affiliation, affiliation_country, affiliation_city,
            orcid, asfi_membership_id,
            email, discipline,
            currentProcess: currentProcess,
            title: null,
            article_discipline: null,
            article_type: null,
            manuscript_file: null,
            tracked_manuscript_file: null,
            coverLetter: null,
            tables: null,
            figures: null,
            graphic_abstract: null,
            SavedAbstract: null,
            supplementaryMaterials: null,
            correspondingAuthor: req.user.email,
            previousId: null,
            status: null,
            Keywords: null,
            Authors: null,
            is_women_in_contemporary: "no",
            suggestedReviewers: null,
            _uid_token: req.query._uid,
            correction,
            edit,
            currentSubmissionProcess,
            revision,
            queriedID
        });

    } catch (error) {
        console.error("Error in uploadArticlePage:", error);
        return res.status(500).json({ error: error.message });
    }
};

module.exports = uploadArticlePage;