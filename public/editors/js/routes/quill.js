
const quill = new Quill('#quilleditor', {
    modules: {
      toolbar: [
        ['bold', 'italic'],
        ['link', 'blockquote', 'code-block', 'image'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ 'header': [1, 2, false] }],
        [{ 'color': [] }],                             // add color picker 
        ['clean']
      ],
    },
    theme: 'snow',
  });
  
 
export {
    quill
}
//   form.addEventListener('formdata', (event) => {
//     // Append Quill content before submitting
//     event.formData.append('article_content', JSON.stringify(quill.getContents().ops));
//     console.log(event.formData)
//   });

  
