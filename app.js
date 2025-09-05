const express = require("express");
const dotenv = require("dotenv").config();
const app = express();
const cookie = require("cookie-parser");
const PORT = process.env.PORT || 31000;
const server = require("http").Server(app);
const session = require("express-session");
const MySQLStore = require('express-mysql-session')(session);
const bodyParser = require("body-parser");
const cors = require('cors');
const path = require("path");

// Trust proxy (important for production)
app.set('trust proxy', 1);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.options('*', cors());

// Session store configuration
const sessionStore = new MySQLStore({
  host: process.env.D_HOST,
  port: process.env.D_PORT || 3306,
  user: process.env.D_USER,
  password: process.env.D_PASSWORD,
  database: process.env.D_NAME,
  clearExpired: true,
  checkExpirationInterval: 900000,
  expiration: 86400000,
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
});

sessionStore.on('error', (error) => {
  console.error('Session store error:', error);
});

// Session middleware
app.use(session({
  secret: process.env.JWT_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

// Other middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(cookie());
app.use(express.json());

// Debug middleware (remove in production)
app.use((req, res, next) => {
  // console.log('Session ID:', req.sessionID);
  // console.log('User in session:', req.session.user.email);
  next();
});

// View engine and static files
app.set("view engine", "ejs");
app.set("views", ["./views", "./views/editors", "./views/authors", "./views/reviewers"]);
app.use("/css", express.static(path.join(__dirname, "public/css")));
app.use("/fonts", express.static(path.join(__dirname, "public/css/fonts")));
app.use("/js", express.static(path.join(__dirname, "public/js")));
app.use("/assets", express.static(path.join(__dirname, "public/assets")));
app.use("/editorStatic/", express.static(path.join(__dirname, "public/editors")));

// Socket.io setup (your existing code)
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket"],
});

// Your socket.io event handlers...

// Routes
app.use("/", require("./routes/pages"));

server.listen(PORT, () => {
  console.log("Server is running on ", PORT);
  console.log("Environment:", process.env.NODE_ENV || 'development');
});