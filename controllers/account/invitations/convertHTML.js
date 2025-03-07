const convertQUILLTOHTML = (contentArray) => {
    let html = "";
    let listOpen = false;
    let listType = "";
  
    contentArray.forEach((item) => {
      if (item.attributes?.list) {
        const currentListType = item.attributes.list;
  
        if (["ordered", "bullet"].includes(currentListType)) {
          if (!listOpen) {
            html += currentListType === "ordered" ? "<ol>" : "<ul>";
            listOpen = true;
            listType = currentListType;
          } else if (listType !== currentListType) {
            html += listType === "ordered" ? "</ol>" : "</ul>";
            html += currentListType === "ordered" ? "<ol>" : "<ul>";
            listType = currentListType;
          }
  
          html += `<li>${item.insert}</li>`;
        }
      } else {
        if (listOpen) {
          html += listType === "ordered" ? "</ol>" : "</ul>";
          listOpen = false;
        }
  
        if (item.insert.image) {
          const src = item.insert.image;
          html += `<img src="${src}" alt="Image">`;
        } else {
          let text = item.insert.replace(/\n/g, "<br>");
  
          if (item.attributes) {
            if (item.attributes.link) {
              text = `<a href="${item.attributes.link}">${text}</a>`;
            }
            if (item.attributes.underline) {
              text = `<u>${text}</u>`;
            }
            if (item.attributes.color) {
              text = `<span style="color:${item.attributes.color};">${text}</span>`;
            }
            if (item.attributes.bold) {
              text = `<strong>${text}</strong>`;
            }
          }
          html += text;
        }
      }
    });
  
    if (listOpen) {
      html += listType === "ordered" ? "</ol>" : "</ul>";
    }
  
    return html;
  };


  module.exports = convertQUILLTOHTML