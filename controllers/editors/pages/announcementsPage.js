const announcementsPage = async (req, res) => {
    try {
        if (req.cookies.asfirj_userRegistered) {
            res.render("announcements", { user: req.user })
        } else {
            res.render("editorLogin")
        }
    } catch (error) {
        console.log(error)
        res.render("success", {status:"error", tag:"Internal Server Error", message:error.message})
    }
}

module.exports = announcementsPage  