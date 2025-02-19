const bcrypt = require('bcrypt');
const db = require('../../routes/db.config');


const createEditorAccount = async (req, res) => {
    const {
        prefix, firstname, lastname, othername, email,
        affiliations, affiliations_country, affiliations_city,
        discipline, orcidID, password
    } = req.body;

    if (!email || !password || !firstname || !lastname || !discipline) {
        return res.json({ status: 'error', message: 'Please fill all fields' });
    }

    try {
        // Check if the email is already in 'submitted_for_edit'
        const [submissionsResult] = await db.execute('SELECT * FROM `submitted_for_edit` WHERE `editor_email` = ?', [email]);
        
        if (submissionsResult.length > 0) {
            // Check if the email already exists in 'authors_account'
            const [authorResult] = await db.execute('SELECT * FROM `authors_account` WHERE `email` = ?', [email]);

            if (authorResult.length > 0) {
                return res.json({ status: 'error', message: 'Account Already Exists' });
            } else {
                // Hash password
                const hashedPassword = await bcrypt.hash(password, 10);
                
                // Insert into authors_account
                const accountStatus = 'verified';
                const reviewerInviteStatus = 'accepted';
                const availableForReview = 'yes';
                await db.execute(
                    `INSERT INTO \`authors_account\` (\`prefix\`, \`email\`, \`orcid_id\`, \`discipline\`, \`firstname\`, \`lastname\`, \`othername\`, \`affiliations\`, \`affiliation_country\`, \`affiliation_city\`, \`is_available_for_review\`, \`is_reviewer\`, \`reviewer_invite_status\`, \`is_editor\`, \`editor_invite_status\`, \`account_status\`, \`password\`)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [prefix, email, orcidID, discipline, firstname, lastname, othername, affiliations, affiliations_country, affiliations_city, availableForReview, availableForReview, reviewerInviteStatus, availableForReview, reviewerInviteStatus, accountStatus, hashedPassword]
                );

                // Insert into editors table if not exists
                const [editorResult] = await db.execute('SELECT * FROM `editors` WHERE `email` = ?', [email]);
                
                if (editorResult.length === 0) {
                    const fullname = `${prefix} ${firstname} ${othername} ${lastname}`;
                    const editorialLevel = 'sectional_editor';

                    await db.execute(
                        'INSERT INTO `editors` (`email`, `fullname`, `password`, `editorial_level`, `editorial_section`) VALUES (?, ?, ?, ?, ?)',
                        [email, fullname, hashedPassword, editorialLevel, discipline]
                    );
                }

                return res.json({ status: 'success', message: 'Account Created Successfully' });
            }
        } else {
            return res.json({ status: 'error', message: 'You are not eligible for this request.' });
        }
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Could not create account', error: error.message });
    }
}

module.exports = createEditorAccount;
