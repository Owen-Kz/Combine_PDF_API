const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const Brevo = require("@getbrevo/brevo");
const dotenv = require("dotenv");
const saveEmailDetails = require("./saveEmail");
const isAdminAccount = require("../../editors/isAdminAccount");
const db = require("../../../routes/db.config");

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const inviteReviewerEmail = async (req, res) => {
  upload.array("attachments[]")(req, res, async (err) => {
    if (err) {
      console.log(err)
      return res.status(500).json({ error:"error", message: "File upload failed" });
    }

    try {
      const apiKey = process.env.BREVO_API_KEY;
      const apiInstance = new Brevo.TransactionalEmailsApi();
      apiInstance.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

      if (!req.cookies.userRegistered) {
        return res.status(401).json({ error:"error", message: "User not logged in" });
      }

      const editorId = req.user.id;
      if (!(await isAdminAccount(editorId))) {
        return res.status(403).json({ error:"error", message: "Not Admin" });
      }

      const { articleId, reviewerEmail, subject, message, ccEmail, bccEmail } = req.body;
      const invitedFor = "Submission Review";
      let attachments = [];

      if (req.files?.length > 0) {
        try {
          attachments = await Promise.all(
            req.files.map(
              (file) =>
                new Promise((resolve, reject) => {
                  const uploadStream = cloudinary.uploader.upload_stream(
                    { resource_type: "auto" },
                    (error, result) => {
                      if (error) reject(error);
                      else resolve({ name: file.originalname, url: result.secure_url });
                    }
                  );
                  uploadStream.end(file.buffer);
                })
            )
          );
        } catch (err) {
          return res.status(500).json({ error:"error", message: "Error uploading files to Cloudinary" });
        }
      }

      let editorEmail;
      try {
        editorEmail = await new Promise((resolve, reject) => {
          db.query(
            "SELECT email FROM editors WHERE id = ? AND editorial_level IN (?, ?, ?)",
            [editorId, "editor_in_chief", "associate_editor", "editorial_assistant"],
            (err, data) => {
              if (err) reject(err);
              else if (data.length === 0) reject("Unauthorized account");
              else resolve(data[0].email);
            }
          );
        });
      } catch (error) {
        return res.status(403).json({ error:"error", message: "Unauthorized account" });
      }

      const isAuthor = await new Promise((resolve, reject) => {
        db.query(
          "SELECT * FROM submission_authors WHERE authors_email = ? AND submission_id = ?",
          [reviewerEmail, articleId],
          (err, data) => {
            if (err) reject(err);
            else resolve(data.length > 0);
          }
        );
      });
      if (isAuthor) {
        return res.status(400).json({ error:"error", message: "The invited reviewer is an author on this article" });
      }

      const existingInvitation = await new Promise((resolve, reject) => {
        db.query(
          "SELECT * FROM submitted_for_review WHERE article_id = ? AND reviewer_email = ? AND status IN (?, ?, ?)",
          [articleId, reviewerEmail, "submitted_for_review", "review_invitation_accepted", "review_submitted"],
          (err, data) => {
            if (err) reject(err);
            else resolve(data.length > 0);
          }
        );
      });
      if (existingInvitation) {
        return res.status(200).json({ message: `An invitation was previously sent to ${reviewerEmail}` });
      }

      await new Promise((resolve, reject) => {
        db.query(
          "UPDATE submissions SET status = 'submitted_for_review' WHERE revision_id = ?",
          [articleId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      saveEmailDetails(reviewerEmail, subject, message, editorEmail, articleId, ccEmail?.split(","), bccEmail?.split(","), attachments, invitedFor);

      const senderEmail = process.env.BREVO_EMAIL;
      console.log(reviewerEmail)
      const emailData = {
        sender: { email: senderEmail, name: "ASFI Research Journal" },
        to: [{ email: reviewerEmail }],
        subject,
        htmlContent: `<p>${message}</p>`,
        ...(ccEmail && { cc: ccEmail.split(",").map((email) => ({ email })) }),
        ...(bccEmail && { bcc: bccEmail.split(",").map((email) => ({ email })) }),
        ...(attachments.length > 0 && {
          attachment: attachments.map((file) => ({
            url: file.url,
            name: file.name,
          })),
        }),
      };

      try {
        await apiInstance.sendTransacEmail(emailData);
        await new Promise((resolve, reject) => {
          db.query(
            "INSERT INTO submitted_for_review (article_id, reviewer_email, submitted_by) VALUES (?, ?, ?)",
            [articleId, reviewerEmail, editorEmail],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);
        await new Promise((resolve, reject) => {
          db.query(
            "INSERT INTO invitations (invited_user, invitation_link, invitation_expiry_date, invited_for, invited_user_name) VALUES (?, ?, ?, ?, ?)",
            [reviewerEmail, articleId, expiryDate.toISOString().split("T")[0], invitedFor, editorEmail],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        return res.json({ status: "success", message: "Email has been sent" });
      } catch (error) {
        return res.status(500).json({ error:"error", message: "Email sending failed" });
      }
    } catch (error) {
      return res.status(500).json({ error:"error", message: error.message });
    }
  });
};

module.exports = inviteReviewerEmail;
