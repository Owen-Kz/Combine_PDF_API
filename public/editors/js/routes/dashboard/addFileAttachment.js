


  // Handle file input changes
  const attachmentInput = document.getElementById("attachmentInput");
  const attachmentPreviewContainer = document.getElementById("attachmentPreviewContainer");

  // Store selected files
  let selectedFiles = [];

  attachmentInput.addEventListener("change", function () {
    const files = Array.from(attachmentInput.files);

    // Add files to selectedFiles if under the limit
    for (const file of files) {
      if (selectedFiles.length >= 10) {
        alert("You can only upload up to 10 files.");
        break;
      }

      selectedFiles.push(file);
    }

    // Update the preview
    updatePreview();

    // Reset the input to allow re-uploading the same file
    // attachmentInput.value = "";
  });

  function updatePreview() {
    // Clear existing previews
    attachmentPreviewContainer.innerHTML = "";

    // Add previews for each file
    selectedFiles.forEach((file, index) => {
      const fileRow = document.createElement("div");
      fileRow.style.display = "flex";
      fileRow.style.justifyContent = "space-between";
      fileRow.style.alignItems = "center";
      fileRow.style.marginBottom = "10px";
      fileRow.style.border = "1px solid #ccc";
      fileRow.style.padding = "5px";

      const fileInfo = document.createElement("span");
      fileInfo.textContent = `${file.name} (${(file.size / 1024).toFixed(2)} KB)`;

      const removeButton = document.createElement("button");
      removeButton.textContent = "Remove";
      removeButton.style.marginLeft = "10px";
      removeButton.style.padding = "5px";
      removeButton.style.border = "none";
      removeButton.style.backgroundColor = "#ff4d4d";
      removeButton.style.color = "white";
      removeButton.style.borderRadius = "3px";
      removeButton.style.cursor = "pointer";

      removeButton.addEventListener("click", () => {
        selectedFiles.splice(index, 1); // Remove file from selectedFiles
        updateAttachmentInput(); // Sync with attachmentInput
        updatePreview(); // Update the preview
      });

      fileRow.appendChild(fileInfo);
      fileRow.appendChild(removeButton);
      attachmentPreviewContainer.appendChild(fileRow);
    });

    // Sync input with selected files
    updateAttachmentInput();
  }

  function updateAttachmentInput() {
    // Create a DataTransfer object to simulate input.files
    const dataTransfer = new DataTransfer();

    // Add files to the DataTransfer object
    selectedFiles.forEach((file) => dataTransfer.items.add(file));

    // Assign the DataTransfer files to the input
    attachmentInput.files = dataTransfer.files;
  }
