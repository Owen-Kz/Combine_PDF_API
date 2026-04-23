

// Modify your existing GetAdminSubmissions function
function GetAdminSubmissions(id, page, searchQuery = '') {
    return fetch(`/editors/allSubmissions?page=${page}`, {
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


