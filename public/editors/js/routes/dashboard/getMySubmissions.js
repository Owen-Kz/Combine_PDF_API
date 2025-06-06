// Modify your existing GetMySubmissions function
async function GetMySubmissions(id, page, searchQuery = '') {
    return fetch(`/editors/mySubmissions?page=${page}`, {
        method: "POST",
        body: JSON.stringify({
            admin_id: id,
            search: searchQuery
        }),
        headers: {
            "Content-type": "application/JSON"
        }
    }).then(res => res.json())
    .then(data => {
        if(data.success) {
            return data.submissions;
        } else {
            console.log(data.error);
            return false;
        }
    });
}



// export{
//     GetMySubmissions
// }