var Inline = Quill.import("blots/inline");

class UppercaseBlot extends Inline {
  static create() {
    let node = super.create();
    node.style.textTransform = "uppercase";
    return node;
  }

  static formats() {
    return true;
  }
}

UppercaseBlot.blotName = "uppercase";
UppercaseBlot.tagName = "span";
UppercaseBlot.className = "ql-uppercase";

Quill.register(UppercaseBlot);

class LowercaseBlot extends Inline {
  static create() {
    let node = super.create();
    node.style.textTransform = "lowercase";
    return node;
  }

  static formats() {
    return true;
  }
}

LowercaseBlot.blotName = "lowercase";
LowercaseBlot.tagName = "span";
LowercaseBlot.className = "ql-lowercase";

Quill.register(LowercaseBlot);

// 🛠️ Custom Toolbar Handler for Uppercase & Lowercase
function customToolbarHandler(quill, format) {
  let range = quill.getSelection();
  if (range) {
    let formatState = quill.getFormat(range);
    quill.format(format, !formatState[format]);
  }
}

// 📌 Function to Initialize Quill Editors
function initializeQuill(selector, content = null) {
  const editor = document.querySelector(selector);
  if (!editor) {
    console.error('Element not found:', selector);
    return null;
  }
  
  // Check if Quill is already initialized on this element
  if (editor.classList.contains('ql-container')) {
    console.log('Quill already initialized on', selector);
    return Quill.find(editor);
  }

  const quillInstance = new Quill(selector, {
    modules: {
      toolbar: {
        container: [
          ["bold", "italic", "underline"],
          ["link", "blockquote", "code-block", "image"],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ header: [1, 2, false] }],
          [{ align: [] }],
          [{ script: "sub" }, { script: "super" }],
          [{ color: [] }, { background: [] }],
          [{ size: ["small", false, "large", "huge"] }],
          ["clean"],
          [{ uppercase: "uppercase" }],
          [{ lowercase: "lowercase" }],
        ],
        handlers: {
          uppercase: function () {
            customToolbarHandler(this.quill, "uppercase");
          },
          lowercase: function () {
            customToolbarHandler(this.quill, "lowercase");
          },
        },
      },
    },
    theme: "snow",
  });

  // Set content if provided
  if (content) {
    try {
      if (typeof content === 'string') {
        quillInstance.root.innerHTML = content;
      } else {
        quillInstance.setContents(content);
      }
    } catch (error) {
      console.error('Error setting Quill content:', error);
      quillInstance.setText(content || '');
    }
  }

  return quillInstance;
}

// Global quill instances
let quillInstance = null;
let quillInstance2 = null;

// Function to get or initialize the main quill editor
function getQuillInstance(selector = '#quilleditor', content = null) {
  if (!quillInstance) {
    quillInstance = initializeQuill(selector, content);
  }
  return quillInstance;
}

// Function to get or initialize the second quill editor
function getQuillInstance2(selector = '#quilleditor2', content = null) {
  if (!quillInstance2 && document.querySelector(selector)) {
    quillInstance2 = initializeQuill(selector, content);
  }
  return quillInstance2;
}

// Function to check if Quill is initialized
function isQuillInitialized() {
  return quillInstance !== null;
}

// Function to destroy Quill instances (for cleanup)
function destroyQuillInstances() {
  if (quillInstance) {
    quillInstance = null;
  }
  
  if (quillInstance2) {
    quillInstance2 = null;
  }
}

export { 
  getQuillInstance, 
  getQuillInstance2, 
  isQuillInitialized, 
  destroyQuillInstances,
  initializeQuill 
};