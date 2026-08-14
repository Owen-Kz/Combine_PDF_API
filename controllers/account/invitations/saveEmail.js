const db = require("../../../routes/db.config");

/**
 * Escape HTML special characters.
 * @param {*} unsafe
 * @returns {string}
 */
const escapeHtml = (unsafe) => {
  if (unsafe == null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Apply Quill attributes (bold, italic, underline, strike, links, color) to an
 * already-escaped text fragment.
 * @param {Object} attrs
 * @param {string} text - escaped text
 * @returns {string}
 */
const applyFormatting = (attrs, text) => {
  let inner = text;
  if (attrs.bold) inner = `<strong>${inner}</strong>`;
  if (attrs.italic) inner = `<em>${inner}</em>`;
  if (attrs.underline) inner = `<u>${inner}</u>`;
  if (attrs.strike) inner = `<s>${inner}</s>`;
  if (attrs.color) inner = `<span style="color:${escapeHtml(attrs.color)}">${inner}</span>`;
  if (attrs.link) inner = `<a href="${escapeHtml(attrs.link)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
  return inner;
};

/**
 * Convert a Quill Delta (array of ops, or {ops}) into formatted HTML.
 * Preserves newlines (blank lines become paragraphs, single newlines become
 * <br>), bold, italic, underline, strike, links, colors, headers, lists,
 * alignment, indent, and images.
 * @param {Array|Object} delta
 * @returns {string}
 */
const quillDeltaToHtml = (delta) => {
  const ops = Array.isArray(delta) ? delta : delta && Array.isArray(delta.ops) ? delta.ops : null;
  if (!ops) return "";

  let html = "";
  let listStack = [];
  let inParagraph = false;

  const closeParagraph = () => {
    if (inParagraph) {
      html += "</p>";
      inParagraph = false;
    }
  };

  const closeLists = () => {
    while (listStack.length > 0) {
      html += `</${listStack.pop()}>`;
    }
  };

  const flushBlocks = () => {
    closeLists();
    closeParagraph();
  };

  ops.forEach((op) => {
    if (!op || typeof op !== "object") return;

    const insert = op.insert;
    const attrs = op.attributes || {};

    // Image embeds
    if (insert && typeof insert === "object" && insert.image) {
      flushBlocks();
      html += `<img src="${escapeHtml(insert.image)}" alt="Image" style="max-width:100%;height:auto;">`;
      return;
    }

    const text = String(insert == null ? "" : insert);
    if (!text) return;

    // Newline-only op ends the current line/paragraph. Inside a list it just
    // ends the current item (the next list op opens a new <li> in the same
    // list, so the <ul> stays open).
    if (text === "\n") {
      if (!attrs.list) flushBlocks();
      return;
    }

    // Render a multi-line block (headers, list items, aligned/indented divs):
    // blank lines are dropped, single newlines become <br>.
    const blockText = (t) =>
      t.split("\n").filter((line) => line !== "").join("<br>");

    // Headers
    if (attrs.header) {
      flushBlocks();
      html += `<h${attrs.header}>${applyFormatting(attrs, escapeHtml(blockText(text)))}</h${attrs.header}>`;
      return;
    }

    // Lists
    if (attrs.list) {
      const listType = attrs.list === "bullet" ? "ul" : "ol";
      if (listStack[listStack.length - 1] !== listType) {
        flushBlocks();
        html += `<${listType}>`;
        listStack.push(listType);
      }
      html += `<li>${applyFormatting(attrs, escapeHtml(blockText(text)))}</li>`;
      return;
    }

    // Alignment
    if (attrs.align) {
      flushBlocks();
      html += `<div style="text-align:${escapeHtml(attrs.align)}">${applyFormatting(attrs, escapeHtml(blockText(text)))}</div>`;
      return;
    }

    // Indentation
    if (attrs.indent) {
      flushBlocks();
      html += `<div style="margin-left:${parseInt(attrs.indent, 10) * 20}px">${applyFormatting(attrs, escapeHtml(blockText(text)))}</div>`;
      return;
    }

    // Regular text: blank lines become paragraph breaks, single newlines
    // become <br>, and a trailing newline simply closes the paragraph.
    let firstLine = true;
    text.split("\n").forEach((line) => {
      if (line === "") {
        closeParagraph();
        return;
      }
      if (!inParagraph) {
        html += "<p>";
        inParagraph = true;
      } else if (!firstLine) {
        // A newline separates this line from the previous line of this op
        html += "<br>";
      }
      html += applyFormatting(attrs, escapeHtml(line));
      firstLine = false;
    });
  });

  flushBlocks();
  return html;
};

/**
 * Normalize an email body into properly formatted HTML before it is saved.
 *
 * Handles:
 *  - Quill Delta JSON (array of ops, or {ops}) -> HTML with newlines, bold, italic
 *  - { message, compiledLetter } wrapper -> uses compiledLetter (HTML) or message
 *  - Already-HTML content -> passed through unchanged
 *  - Plain text -> wrapped in <p> tags, preserving newlines
 *
 * @param {string|Array|Object} message
 * @returns {string}
 */
const normalizeEmailBody = (message) => {
  if (message == null) return "";

  if (typeof message === "object") {
    if (Array.isArray(message)) return quillDeltaToHtml(message);
    if (message.ops) return quillDeltaToHtml(message.ops);
    if (message.compiledLetter || message.message) {
      return normalizeEmailBody(message.compiledLetter || message.message);
    }
    return "";
  }

  const trimmed = String(message).trim();
  if (!trimmed) return String(message);

  // JSON-encoded Quill Delta or { message, compiledLetter } wrapper
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return quillDeltaToHtml(parsed);
      if (parsed && Array.isArray(parsed.ops)) return quillDeltaToHtml(parsed.ops);
      if (parsed && (parsed.compiledLetter || parsed.message)) {
        return normalizeEmailBody(parsed.compiledLetter || parsed.message);
      }
    } catch (e) {
      // Not valid JSON — fall through to HTML / plain-text handling
    }
  }

  // Already HTML — store as-is
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return String(message);

  // Plain text — preserve paragraphs and line breaks
  return String(message)
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph ? `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>` : ""
    )
    .join("");
};

const saveEmailDetails = async (
  recipientEmail,
  subject,
  message,
  senderEmail,
  articleId,
  ccEmails = [],
  bccEmails = [],
  attachments = [],
  invitedFor = "",
  status = "Sent",
  errorMessage = null
) => {
  try {
    let emailId = null;

    // Store a properly formatted HTML version of the body so the version
    // saved in sent_emails matches how the email was composed (newlines,
    // bold, italic, links, lists, etc).
    const body = normalizeEmailBody(message);

    // Always record a new row for failures; otherwise reuse an existing record
    const isFailureLog = !!errorMessage || status === "Failed";

    if (!isFailureLog) {
      const existingEmails = await new Promise((resolve, reject) => {
        db.query(
          "SELECT id FROM sent_emails WHERE recipient = ? AND subject = ? AND sender = ? AND article_id = ? AND email_for = ?",
          [recipientEmail, subject, senderEmail, articleId, invitedFor],
          (err, result) => {
            if (err) {
              console.log(err)
              reject(err);
            }
            else resolve(result);
          }
        );
      });

      if (existingEmails.length > 0) {
        emailId = existingEmails[0].id;
      }
    }

    const isNewEmail = !emailId;

    if (isNewEmail) {
      const hasError = !!errorMessage;
      const columns = "`recipient`, `subject`, `body`, `sender`, `article_id`, `email_for`, `status`" +
        (hasError ? ", `error_message`" : "");
      const placeholders = hasError ? "?, ?, ?, ?, ?, ?, ?, ?" : "?, ?, ?, ?, ?, ?, ?";
      const emailValues = hasError
        ? [recipientEmail, subject, body, senderEmail, articleId, invitedFor, status, errorMessage]
        : [recipientEmail, subject, body, senderEmail, articleId, invitedFor, status];

      const emailResult = await new Promise((resolve, reject) => {
        db.query(
          `INSERT INTO sent_emails (${columns}) VALUES (${placeholders})`,
          emailValues,
          (err, result) => {
            if (err) reject(err);
            else resolve(result);
          }
        );
      });

      emailId = emailResult.insertId;
    }

    // Only insert CC, BCC, and attachments if the email was newly saved
    if (isNewEmail) {
      // Save CC emails
      if (ccEmails && ccEmails.length > 0) {
        const ccValues = ccEmails.map((email) => [emailId, email]);

        await new Promise((resolve, reject) => {
          db.query("INSERT INTO email_cc (email_id, cc_email) VALUES ?", [ccValues], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      }

      // Save BCC emails
      if (bccEmails && bccEmails.length > 0) {
        const bccValues = bccEmails.map((email) => [emailId, email]);

        await new Promise((resolve, reject) => {
          db.query("INSERT INTO email_bcc (email_id, bcc_email) VALUES ?", [bccValues], (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      }

      // Save attachments
      if (attachments && attachments.length > 0) {
        const attachmentValues = attachments.map((attachment) => [
          emailId,
          attachment.name,
          attachment.url || attachment.file_path || null,
          attachment.size || attachment.file_size || null,
          attachment.mimetype || attachment.mime_type || attachment.contentType || null
        ]);

        await new Promise((resolve, reject) => {
          db.query(
            "INSERT INTO email_attachments (email_id, file_name, file_path, file_size, mime_type) VALUES ?",
            [attachmentValues],
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
        });
      }
    }
    console.log("Email details saved successfully");
    return emailId;
  } catch (error) {
    console.error("Error saving email details:", error);
    throw error;
  }
};

module.exports = saveEmailDetails;
