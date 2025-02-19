$(".search").on("keyup", function () {
    var value = $(this).val().toLowerCase();
    $(".submissionsContainer tr").filter(function () {
        $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1)
    });
});