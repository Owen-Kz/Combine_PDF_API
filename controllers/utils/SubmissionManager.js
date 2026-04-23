const dbPromise = require("../../routes/dbPromise.config");
const generateArticleId = require("../generateArticleId");

class SubmissionManager {
    static async initializeSubmission(req, type = 'new', submissionId = null) {
        try {
            const userId = req.user.id;
            const userEmail = req.user.email;

            console.log("Initializing submission:", { type, submissionId });
if (type === 'existing-new' && submissionId) {
            // Check if this is a correction or revision
            console.log("INGLOROUTI", req.query)
            const hasAnswer = Boolean(req.query.a);
            const correctionFlag = req.query.correct || req.query.correction;
            const revisionFlag = req.query.revise || req.query.revision;

            const isCorrection = hasAnswer && (correctionFlag === 'true' || correctionFlag === 'correction');
            const isRevision = hasAnswer && revisionFlag === 'true';
            const originalArticleId = req.query.a;

            // For corrections and revisions, let generateArticleId handle the database creation
            if (isCorrection || isRevision) {
                console.log(`Processing ${isCorrection ? 'correction' : 'revision'} for article:`, originalArticleId);

                // This will create the database record and return the new ID
                const newArticleId = await generateArticleId(req);

                // Now get the actual submission data from the database
                const newSubmission = await this.getSubmissionData(newArticleId, userEmail);
                if (!newSubmission) {
                    throw new Error(`Failed to create ${isCorrection ? 'correction' : 'revision'} submission`);
                }

                // Get original data to copy related records
                const originalSubmission = await this.getSubmissionData(originalArticleId, userEmail);

                return {
                    submission: newSubmission,
                    articleId: newArticleId,
                    keywords: originalSubmission ? await this.getSubmissionKeywords(originalArticleId) : [],
                    authors: originalSubmission ? await this.getSubmissionAuthors(originalArticleId) : [],
                    suggestedReviewers: originalSubmission ? await this.getSubmissionReviewers(originalArticleId) : [],
                    isNew: false,
                    isCorrection: isCorrection,
                    isRevision: isRevision,
                    originalArticleId: originalArticleId
                };
            }
        }
            // For existing submissions
            if (type === 'existing' && submissionId) {
                const submission = await this.getSubmissionData(submissionId, userEmail);

                if (submission) {
                    console.log("Found existing submission:", submissionId);
                    return {
                        submission,
                        articleId: submission.revision_id,
                        keywords: await this.getSubmissionKeywords(submission.revision_id),
                        authors: await this.getSubmissionAuthors(submission.revision_id),
                        suggestedReviewers: await this.getSubmissionReviewers(submission.revision_id),
                        isNew: false
                    };
                } else {
                    throw new Error(`Submission ${submissionId} not found for user ${userEmail}`);
                }
            }

            // For new submissions
            if (type === 'new') {
                const articleId = await generateArticleId(req);
                console.log("Created new submission:", articleId);

                // Get the actual submission data from database
                const submission = await this.getSubmissionData(articleId, userEmail);

                return {
                    submission: submission || {
                        revision_id: articleId,
                        article_id: articleId,
                        corresponding_authors_email: userEmail,
                        status: 'draft'
                    },
                    articleId,
                    keywords: [],
                    authors: [],
                    suggestedReviewers: [],
                    isNew: true
                };
            }

            throw new Error(`Invalid submission type: ${type}`);

        } catch (error) {
            console.error('Error in initializeSubmission:', error);
            throw error;
        }
    }

    static async getSubmissionData(submissionId, userEmail) {
        console.log("Fetching submission data for:", submissionId, userEmail);
        try {
            const [submissions] = await dbPromise.query(
                `SELECT * FROM submissions 
                 WHERE (revision_id = ? OR article_id = ?) AND corresponding_authors_email = ?`,
                [submissionId, submissionId, userEmail]
            );

            if (submissions.length > 0) {
                console.log("Found submission in database:", submissions[0].revision_id);
                return submissions[0];
            } else {
                console.log("No submission found in database for:", submissionId);
                return null;
            }
        } catch (error) {
            console.error('Error fetching submission data:', error);

            if (error.code === 'ER_NO_SUCH_TABLE') {
                console.error('Submissions table not found. Database may need setup.');
                throw new Error('System configuration error. Please contact support.');
            }

            throw error;
        }
    }

    static async getSubmissionKeywords(submissionId) {
        try {
            const [keywords] = await dbPromise.query(
                `SELECT keyword FROM submission_keywords 
                 WHERE article_id = ? ORDER BY created_at`,
                [submissionId]
            );
            console.log(keywords)
            return keywords.map(k => ({ keyword: k.keyword }));
        } catch (error) {
            console.error('Error fetching keywords:', error);

            // If keywords table doesn't exist, return empty array
            if (error.code === 'ER_NO_SUCH_TABLE') {
                return [];
            }

            return [];
        }
    }

    static async getSubmissionAuthors(submissionId) {
        try {
            const [authors] = await dbPromise.query(
                `SELECT authors_fullname, authors_email, orcid_id, asfi_membership_id, 
                        affiliations, affiliation_country, affiliation_city 
                 FROM submission_authors 
                 WHERE submission_id = ? ORDER BY created_at`,
                [submissionId]
            );
            return authors;
        } catch (error) {
            console.error('Error fetching authors:', error);

            // If authors table doesn't exist, return empty array
            if (error.code === 'ER_NO_SUCH_TABLE') {
                return [];
            }

            return [];
        }
    }

    static async getSubmissionReviewers(submissionId) {
        try {
            const [reviewers] = await dbPromise.query(
                `SELECT fullname, email, affiliation, affiliation_country, affiliation_city
                 FROM suggested_reviewers 
                 WHERE article_id = ? ORDER BY created_at`,
                [submissionId]
            );
            return reviewers;
        } catch (error) {
            console.error('Error fetching reviewers:', error);

            // If reviewers table doesn't exist, return empty array
            if (error.code === 'ER_NO_SUCH_TABLE') {
                console.log("Reviewers table does not exist")
                return [];
            }

            return [];
        }
    }

    static async saveStepData(submissionId, step, data) {
        console.log(data)
        try {
            // Validate submission exists and user has access
            const submission = await this.getSubmissionData(submissionId, data.userEmail || data.corresponding_authors_email);
            if (!submission) {
                throw new Error('Submission not found or access denied');
            }

            // Update main submission table with step data
            const updateFields = this.getUpdateFieldsForStep(step, data);
            console.log("Update fields:", updateFields);
            console.log("Submission ID:", submissionId);
            console.log("Step:", step);

            if (Object.keys(updateFields).length > 0) {
                await dbPromise.query(
                    `UPDATE submissions SET ? WHERE revision_id = ?`,
                    [updateFields, submissionId]
                );
            }

            // Handle related data (keywords, authors, reviewers)
            await this.saveRelatedData(submissionId, step, data);

            return { success: true };
        } catch (error) {
            console.error('Error saving step data:', error);
            throw error;
        }
    }

    static getUpdateFieldsForStep(step, data) {
        const stepFieldMap = {
            'article_type': ['article_type', 'discipline', 'previous_manuscript_id', 'is_women_in_contemporary_science', 'corresponding_authors_email'],
            'title': ['title'],
            'abstract': ['abstract'],
            'upload_manuscript': ['manuscript_file', 'cover_letter_file', 'document_file', 'tables', 'figures', 'graphic_abstract', 'supplementary_material', 'tracked_manuscript_file'],
            'disclosures': ['is_women_in_contemporary_science']
        };

        const fields = stepFieldMap[step] || [];
        const updateData = {};

        fields.forEach(field => {
            if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
                updateData[field] = data[field];
            }
        });

        // Handle special field mappings for your form structure
        this.mapSpecialFields(step, data, updateData);

        // Always update the last_updated timestamp
        updateData.last_updated = new Date();

        return updateData;
    }

    static mapSpecialFields(step, data, updateData) {
        switch (step) {
            case 'article_type':
                // Map form fields to database fields
                if (data.article_type) updateData.article_type = data.article_type;
                if (data.discipline) updateData.discipline = data.discipline;
                if (data.is_women_in_contemporary_science) {
                    updateData.is_women_in_contemporary_science = data.is_women_in_contemporary_science;
                }
                if (data.previous_manuscript_id) {
                    updateData.previous_manuscript_id = data.previous_manuscript_id;
                }
                break;

            case 'title':
                if (data.title) updateData.title = data.title;
                break;

            case 'abstract':
                if (data.abstract) updateData.abstract = data.abstract;
                break;

            case 'upload_manuscript':
                // File fields are handled by the file upload system
                // These would be set when files are uploaded
                break;

            case 'disclosures':
                // Handle disclosure confirmations
                if (data.disclosure_confirm) {
                    updateData.is_women_in_contemporary_science = data.disclosure_confirm;
                }
                break;
        }
    }

    static async saveRelatedData(submissionId, step, data) {
        try {
            switch (step) {
                case 'keywords':
                    console.log(data)
                    if (data.keywords && Array.isArray(data.keywords)) {
                        await this.saveKeywords(submissionId, data.keywords);
                    } else if (data.keyword && Array.isArray(data.keyword)) {
                        // Handle the form field name 'keyword[]'
                        await this.saveKeywords(submissionId, data.keyword);
                    }
                    break;

                case 'authors':
                    if (data.authors && Array.isArray(data.authors)) {
                        await this.saveAuthors(submissionId, data.authors);
                    } else {
                        // Extract authors from form data structure
                        const authors = this.extractAuthorsFromFormData(data);
                        if (authors.length > 0) {
                            await this.saveAuthors(submissionId, authors);
                        }
                    }
                    break;

                case 'reviewers':
                    if (data.reviewers && Array.isArray(data.reviewers)) {
                        await this.saveReviewers(submissionId, data.reviewers);
                    } else {
                        // Extract reviewers from form data structure
                        const reviewers = this.extractReviewersFromFormData(data);
                        if (reviewers.length > 0) {
                            await this.saveReviewers(submissionId, reviewers);
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error saving ${step} data:`, error);
            // Don't re-throw for related data - main submission update should succeed
        }
    }

    static extractAuthorsFromFormData(data) {
        const authors = [];

        // Handle logged-in author (main author)
        if (data.loggedIn_authors_first_name && data.loggedIn_authors_last_name) {
            authors.push({
                authors_fullname: `${data.loggedIn_authors_prefix || ''} ${data.loggedIn_authors_first_name} ${data.loggedIn_authors_other_name || ''} ${data.loggedIn_authors_last_name}`.trim(),
                authors_email: data.loggedIn_author || data.corresponding_author,
                orcid_id: data.loggedIn_authors_ORCID,
                asfi_membership_id: data.loggedIn_membership_id,
                affiliations: data.loggedIn_affiliation,
                affiliation_country: data.loggedIn_affiliation_country,
                affiliation_city: data.loggedIn_affiliation_city
            });
        }

        // Handle additional authors from arrays
        if (data['authors_first_name[]'] && Array.isArray(data['authors_first_name[]'])) {
            const authorCount = data['authors_first_name[]'].length;

            for (let i = 0; i < authorCount; i++) {
                if (data['authors_first_name[]'][i] && data['authors_last_name[]'][i]) {
                    authors.push({
                        authors_fullname: `${data['authors_prefix[]']?.[i] || ''} ${data['authors_first_name[]'][i]} ${data['authors_other_name[]']?.[i] || ''} ${data['authors_last_name[]'][i]}`.trim(),
                        authors_email: data['email[]']?.[i] || '',
                        orcid_id: data['authors_orcid[]']?.[i] || '',
                        asfi_membership_id: data['membership_id[]']?.[i] || '',
                        affiliations: data['affiliation[]']?.[i] || '',
                        affiliation_country: data['affiliation_country[]']?.[i] || '',
                        affiliation_city: data['affiliation_city[]']?.[i] || ''
                    });
                }
            }
        }

        return authors;
    }

    static extractReviewersFromFormData(data) {
        const reviewers = [];

        if (data['suggested_reviewer_fullname[]'] && Array.isArray(data['suggested_reviewer_fullname[]'])) {
            const reviewerCount = data['suggested_reviewer_fullname[]'].length;

            for (let i = 0; i < reviewerCount; i++) {
                if (data['suggested_reviewer_fullname[]'][i]) {
                    reviewers.push({
                        fullname: data['suggested_reviewer_fullname[]'][i],
                        email: data['suggested_reviewer_email[]']?.[i] || '',
                        affiliation: data['suggested_reviewer_affiliation[]']?.[i] || '',
                        affiliation_country: data['suggested_reviewer_country[]']?.[i] || '',
                        affiliation_city: data['suggested_reviewer_city[]']?.[i] || ''
                    });
                }
            }
        }

        return reviewers;
    }

    static async saveKeywords(submissionId, keywords) {
        // Filter out empty keywords
        const validKeywords = keywords.filter(k => k && k.trim().length > 0);

        if (validKeywords.length === 0) {
            // Clear existing keywords if no valid ones provided
            await dbPromise.query(
                `DELETE FROM submission_keywords WHERE article_id = ?`,
                [submissionId]
            );
            return;
        }

        // Use transaction for keyword operations
        let connection;
        try {
            connection = await dbPromise.getConnection();
            await connection.beginTransaction();

            // Clear existing keywords
            await dbPromise.query(
                `DELETE FROM submission_keywords WHERE article_id = ?`,
                [submissionId]
            );

            // Insert new keywords
            const keywordValues = validKeywords.map(keyword => [submissionId, keyword.trim()]);
            console.log("Keyword values", keywordValues)
            await dbPromise.query(
                `INSERT INTO submission_keywords (article_id, keyword) VALUES ?`,
                [keywordValues]
            );

            await connection.commit();
        } catch (error) {
            if (connection) await connection.rollback();
            throw error;
        } finally {
            if (connection) connection.release();
        }
    }

    static async saveAuthors(submissionId, authors) {
        // Filter out invalid authors
        const validAuthors = authors.filter(a => a && a.authors_fullname && a.authors_fullname.trim().length > 0);

        if (validAuthors.length === 0) {
            // Clear existing authors if no valid ones provided
            await dbPromise.query(
                `DELETE FROM submission_authors WHERE submission_id = ?`,
                [submissionId]
            );
            return;
        }

        let connection;
        try {
            connection = await dbPromise.getConnection();
            await connection.beginTransaction();

            // Clear existing authors
            await dbPromise.query(
                `DELETE FROM submission_authors WHERE submission_id = ?`,
                [submissionId]
            );

            // Insert new authors
            const authorValues = validAuthors.map(author => [
                submissionId,
                author.authors_fullname?.trim(),
                author.authors_email?.trim(),
                author.orcid_id?.trim(),
                author.asfi_membership_id?.trim(),
                author.affiliations?.trim(),
                author.affiliation_country?.trim(),
                author.affiliation_city?.trim()
            ]);

            await dbPromise.query(
                `INSERT INTO submission_authors 
                 (submission_id, authors_fullname, authors_email, orcid_id, asfi_membership_id, 
                  affiliations, affiliation_country, affiliation_city) 
                 VALUES ?`,
                [authorValues]
            );

            await connection.commit();
        } catch (error) {
            if (connection) await connection.rollback();
            throw error;
        } finally {
            if (connection) connection.release();
        }
    }

    static async saveReviewers(submissionId, reviewers) {
        // Filter out invalid reviewers
        const validReviewers = reviewers.filter(r => r && r.fullname && r.fullname.trim().length > 0);

        if (validReviewers.length === 0) {
            // Clear existing reviewers if no valid ones provided
            await dbPromise.query(
                `DELETE FROM suggested_reviewers WHERE article_id = ?`,
                [submissionId]
            );
            return;
        }

        let connection;
        try {
            connection = await dbPromise.getConnection();
            await connection.beginTransaction();

            // Clear existing reviewers
            await dbPromise.query(
                `DELETE FROM suggested_reviewers WHERE article_id = ?`,
                [submissionId]
            );

            // Insert new reviewers
            const reviewerValues = validReviewers.map(reviewer => [
                submissionId,
                reviewer.fullname?.trim(),
                reviewer.email?.trim(),
                reviewer.affiliation?.trim(),
                reviewer.affiliation_country?.trim(),
                reviewer.affiliation_city?.trim()
            ]);

            await dbPromise.query(
                `INSERT INTO suggested_reviewers 
                 (article_id, fullname, email, affiliation, affiliation_country, affiliation_city) 
                 VALUES ?`,
                [reviewerValues]
            );

            await connection.commit();
        } catch (error) {
            if (connection) await connection.rollback();
            throw error;
        } finally {
            if (connection) connection.release();
        }
    }

    static async getUserDrafts(userEmail) {
        try {
            const [drafts] = await dbPromise.query(
                `SELECT revision_id, article_id, title, status, last_updated 
                 FROM submissions 
                 WHERE corresponding_authors_email = ? AND status IN ('draft', 'saved_for_later', 'correction_saved', 'revision_saved')
                 ORDER BY last_updated DESC`,
                [userEmail]
            );
            console.log("drafts", drafts)
            return drafts;
        } catch (error) {
            console.error('Error fetching user drafts:', error);
            return [];
        }
    }

    // Helper method to get form data for auto-saving
    static extractFormData(formData) {
        const data = {};

        for (const [key, value] of formData.entries()) {
            if (key.endsWith('[]')) {
                // Handle array fields
                const baseKey = key.slice(0, -2);
                if (!data[baseKey]) {
                    data[baseKey] = [];
                }
                data[baseKey].push(value);
            } else {
                data[key] = value;
            }
        }

        return data;
    }
}

module.exports = SubmissionManager;