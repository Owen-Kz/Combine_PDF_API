

function archivePaper(submissionId){
fetch(`/editors/archiveSubmission`,{
  method: 'POST',
  headers: {
      'Content-Type': 'application/json'
  },
  body: JSON.stringify({
      submissionId: submissionId
  })
})
.then(res => res.json())
  .then(data =>{
      if(data){
 console.log(data)
      if(data.success){
          alert(data.success)
      }else{
          alert(data.error)
      }
  }else{
      alert('An error occurred. Please try again later')
  }
  }).catch(err => {
      console.log(err)
      alert('An error occurred. Please try again later')
  })

}


