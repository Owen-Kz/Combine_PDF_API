import { EndPoint } from "../constants.js";
import { quill } from "./quill.js";

const uploadForm = document.getElementById("uploadArticle");
const body = document.querySelector("body")


uploadForm.addEventListener("submit", function(e) {
    e.preventDefault();
    const formData = new FormData(uploadForm);
    formData.append('article_content', JSON.stringify(quill.getContents().ops));



    body.removeAttribute("id")
    // formData.append('article_content', JSON.stringify(quill.getContents().ops));
    // console.log(JSON.stringify(quill.getContents().ops))

    fetch(`${EndPoint}/temporaryManuscriptUpload.php`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log(data); // Log server response
        if(data.status === "success"){
            alert("Upload Successful")
            window.location.href = "../supplements.html#supplements"
        }else if(data.status === "error"){
            alert(data.message)
            body.setAttribute("id", "formNotSubmitted")
        }else{
            alert("Internal Server Error")
            body.setAttribute("id", "formNotSubmitted")
        }

    })
    .catch(error => {
        console.error('Error:', error);
    });
});

