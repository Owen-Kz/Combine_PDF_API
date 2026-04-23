function fetchOrcidData(orcidUrl) {
    // const orcidUrl = document.getElementById('orcid-url').value;
    const orcidId = orcidUrl.split('/').pop(); // Extract the ORCID iD from the URL
    return orcidId
    // fetch(`fetch_orcid_data.php?orcid=${orcidId}`)
    //     .then(response => response.json())
    //     .then(data => {
    //         if (data) {
    //             document.getElementById('user-name').textContent = `Name: ${data['name']}`;
    //             // Fill other fields as needed
    //         } else {
    //             document.getElementById('user-name').textContent = 'No data found';
    //         }
    //     })
    //     .catch(error => console.error('Error fetching ORCID data:', error));
}


export {
    fetchOrcidData
}