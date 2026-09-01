const db = require("../../routes/db.config");
const dbPromise = require("../../routes/dbPromise.config");

const MANAGER_LEVELS = ["admin", "administrator", "editor_in_chief", "editor-in-chief"];

const isEditorInChiefOrAdmin = async (id) => {
  try {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM editors WHERE id = ? AND (editorial_level = 'admin' OR editorial_level = 'administrator' OR editorial_level = 'editor_in_chief' OR editorial_level = 'editor-in-chief')",
        [id],
        async (error, data) => {
          if (error) {
            console.log(error);
            reject(error);
            return;
          }
          if (data && data[0]) {
            resolve(true);
            return;
          }
          try {
            const [isAuthorFirst] = await dbPromise.query(
              "SELECT email FROM authors_account WHERE id = ? LIMIT 1",
              [id]
            );
            if (isAuthorFirst.length > 0) {
              const [isManagerEditor] = await dbPromise.query(
                "SELECT * FROM editors WHERE email = ? AND (editorial_level = 'admin' OR editorial_level = 'administrator' OR editorial_level = 'editor_in_chief' OR editorial_level = 'editor-in-chief')",
                [isAuthorFirst[0].email]
              );
              if (isManagerEditor.length > 0) {
                resolve(true);
                return;
              }
            }
            resolve(false);
          } catch (err) {
            console.log(err);
            resolve(false);
          }
        }
      );
    });
  } catch (error) {
    console.log(error);
    return false;
  }
};

module.exports = isEditorInChiefOrAdmin;