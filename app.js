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

// const io = require("socket.io")(server, {
//   port: 5000 // Change this to your desired port number
// })
const http = require("http");
// const servr = http.createServer(app);

// const io = require("socket.io")(servr, {
//   cors: {
//     origin: '*',
//     methods: ["GET", "POST"],
//     credentials: true
//   }
// });


// const io = require('socket.io')(server, {
//   port: 5000,
//   cors: {
//       origin: '*',
//       methods: ["GET", "POST"],
//       // allowedHeaders: ["my-custom-header"],    // Optional: Specify custom headers
//       credentials: true ,
//   },
 
// // transports: ["websocket"], 
//   // pingTimeout: 60000, // Wait 60 seconds before assuming the connection is lost
//   // pingInterval: 25000, // Send a ping every 25 seconds
// });
const {Server} = require('socket.io');
const SaveMessage = require("./external/saveMessage");
const saveSpaceMessage = require("./external/saveSpaceMessage");
require('debug')('socket.io');

const io = new Server(server, {
  cors: {
    origin: '*', // Update with your actual origin
    methods: ["GET", "POST"],
    credentials: true ,

},
transports: ["websocket"],
});

let socketsConnected = new Set();

io.on('connection', onConnected);

function onConnected(socket) {
console.log('Socket connected', socket.id);
socketsConnected.add(socket.id);
io.emit('clients-total', socketsConnected.size);
socket.on('disconnect', () => {
 
  socketsConnected.delete(socket.id); 
  io.emit('clients-total', socketsConnected.size);
});

// Generate a unique room ID for this pair of users
socket.on("join-room", (roomId, userId) => {
  socket.join(roomId); // Join the room
  console.log(`User ${userId} joined room: ${roomId}`);
});


socket.on("message", async (data, roomId) => {
  try {

    // Emit the message to all users in the room
    io.to(roomId).emit("chat-message", data);
     if (!data.files || !data.files.length) {
      await SaveMessage(data, roomId);
    }
  } catch (error) {
    console.log("Error handling message:", error);
  }
});





socket.on("feedback", (data) => {
  socket.broadcast.emit("feedback", data);
});




  // THE SOCKET IO CHAT SYSTEM FOR SPACES GOES HERE
  socket.on('join-group-chat', async (roomId) => {
    socket.join(roomId); // Join the group chat room
  });

  socket.on('leave-group-chat', async (roomId) => {
    socket.leave(roomId); // Leave the group chat room
  });

  socket.on('group-chat-message', async (data, roomId) => {

  io.to(roomId).emit('group-chat-message', data);


  if (!data.files || !data.files.length) {
    await saveSpaceMessage(data)
  }


  });



}

app.use("/", require("./routes/pages"));

 
server.listen(PORT); 
console.log("Server is running on ", PORT)