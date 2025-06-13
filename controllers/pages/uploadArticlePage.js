const session = require("express-session");
const findManuscript = require("../utils/findManuscript");
const findKeywords = require("../utils/findKeywords");
const findAuthors = require("../utils/findAuthors");
const findReviewers = require("../utils/findReviewers");
const db = require("../../routes/db.config");
const findRevisionId = require("../utils/findRevisionId");

const uploadArticlePage = async (req, res) => {

    try {
        let ArticleId = req.session.articleId;

        let NewRevisionId = "";

        // Initialize session if not exists
        if (!req.session.manuscriptData) {
            req.session.manuscriptData = {};
        }

     

        // if (!req.session.articleId) {
        //     req.session.articleId = await generateArticleId(req, res);
        // }
        req.session.manuscriptData.sessionID = req.session.articleId;
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





        const renderPlainPage = () => {
            const currentProcess = "saved_for_later";
            return res.render("uploadPage", {
                articleId: ArticleId,
                article_id: ArticleId,
                firstname, lastname, othername, prefix,
                affiliation, affiliation_country, affiliation_city,
                orcid, asfi_membership_id,
                email, discipline,
                currentProcess,
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
                _uid_token: req.query._uid
            });
        };

        if (req.query.a || req.query.prg) {


            return res.render("uploadPage", {
                articleId: req.session.article_data.revision_id,
                article_id:req.session.articleId,
                firstname, lastname, othername, prefix,
                affiliation, affiliation_country, affiliation_city,
                orcid, asfi_membership_id,
                email, discipline,
                SavedAbstract: req.session.article_data.abstract,
                title: req.session.article_data.title,
                article_discipline: req.session.article_data.discipline,
                article_type: req.session.article_data.article_type,
                manuscript_file: req.session.article_data.manuscript_file,
                tracked_manuscript_file: req.session.article_data.tracked_manuscript_file,
                coverLetter: req.session.article_data.cover_letter_file,
                tables: req.session.article_data.tables,
                figures: req.session.article_data.figures,
                graphic_abstract: req.session.article_data.graphic_abstract,
                supplementaryMaterials: req.session.article_data?.supplementary_material ?? "not-found",
                correspondingAuthor: req.session.article_data.corresponding_authors_email,
                // article_id: req.session.article_data.article_id,
                previousId: req.session.article_data.article_id,
                status: req.session.article_data.status,
                Keywords: req.keywords,
                Authors: req.submissionAuthors,
                is_women_in_contemporary: req.session.article_data.is_women_in_contemporary_science,
                suggestedReviewers: req.suggested_reviewers,
                currentProcess: req.current_process,
                _uid_token: req.query._uid
            });

        } else {
            renderPlainPage();
        }


    } catch (error) {
        console.error("Error in uploadArticlePage:", error);
        return res.status(500).json({ error: error.message });
    }
};

module.exports = uploadArticlePage;