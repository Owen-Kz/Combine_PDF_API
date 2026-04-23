
function getAcceptedSubmissions(id, page, search=''){
   return fetch(`/editors/allAcceptedSubmissions?page=${page}&search=${search}`, {
        method: "POST",
        body:JSON.stringify({admin_id:id, search:search}),
        headers:{
            "Content-type" : "application/JSON"
        }
    }).then(res=>res.json())
    .then(data=>{
        if(data.success){
            return data.submissions
        }else{
            console.log(data.error)
            return false
        }

    })
}


