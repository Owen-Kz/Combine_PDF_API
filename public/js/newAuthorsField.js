document.addEventListener('DOMContentLoaded', function() {
            
    const addAuthorButton = document.getElementById('addAuthor');
    const authorsContainer = document.getElementById('authors');

function CreateElement(){
    const newInput = document.createElement('div');
  newInput.innerHTML = `
<br/>
<div class="inputContainers">
                        <select id="author_information_prefix" name="authors_prefix[]" class="inputFields">
                            <option value="">Select Title</option>
                            <option value="Prof">Prof.</option>
                            <option value="Dr">Dr.</option>
                            <option value="Mr">Mr.</option>
                            <option value="Mrs">Mrs.</option>
                            <option value="Ms">Ms.</option>
                        </select>
                        <input type="text" class="inputFields" placeholder="First Name..." name="authors_first_name[]">
                        <input type="text" class="inputFields" placeholder="Middle Name..." name="authors_middle_name[]">
                        <input type="text" class="inputFields" placeholder="Last Name..." name="authors_last_name[]">
                        <!-- <input type="text" class="form-control" placeholder="Enter Author..." name="authors[]" id="authors" required> -->
                        <input type="email" class="inputFields" placeholder="Email..." name="authors_email[]">
                        <input type="text" class="inputFields" placeholder="Affiliation..." name="authors_institution[]">
                    </div>
`;

        authorsContainer.appendChild(newInput);
}

    addAuthorButton.addEventListener('click', function() {
        CreateElement()
    });
});