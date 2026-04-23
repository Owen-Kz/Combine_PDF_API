const saveSpaceMessage = async (data) =>{
    const response = await fetch(`${process.env.ASFI_SCHOLAR}/y/saveSpaceMessage`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    const responseData = await response.json();
    if (responseData.success) {
        return responseData; // resolve the promise with the response data
    } else {
        console.log(responseData.error)
        throw new Error(responseData.error); // reject the promise with an error
    }
}

module.exports = saveSpaceMessage