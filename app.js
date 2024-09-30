const express = require("express");
const dotenv = require("dotenv").config();

const app =  express();
const cookie = require("cookie-parser");
const PORT = process.env.PORT || 31000;
const server = require("http").Server(app)

const bodyParser = require("body-parser");



  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.urlencoded({ extended: true }));
app.use(cookie());
app.use(express.json());



app.set("view engine", "ejs");

app.set("views", ["./views", "./views/admin", "./public/directory/profile", "./public/", "./public/userUpload/books", "./public/directory", "./public/userUpload/audio"]);



app.use("/", require("./routes/pages"));

 
server.listen(PORT); 
console.log("Server is running on ", PORT)