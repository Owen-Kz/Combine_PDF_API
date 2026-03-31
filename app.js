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
const { LogAction } = require("./Logger");

// Trust proxy (important for shared/proxy hosting)
app.set('trust proxy', 1);

// In your server.js file, replace the CORS configuration with this:
const cors = require('cors');

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'https://portal.asfirj.org',
      'http://localhost:3000',
      'https://asfirj.org',
      'https://process.asfirj.org'
    ];
    
    // Check if the origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Response-Time'],
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware BEFORE other middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// app.use((req, res, next) => {
//   LogAction(`Incoming request: ${req.method} ${req.url}`);
//   // res.setHeader('Access-Control-Allow-Origin', '*'); //temporarily allow all origins for testing, change to specific frontend url in production
//   // res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//   // res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
//   // res.setHeader('Access-Control-Allow-Credentials', 'true');
//   next();
// });

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
// app.use(session({
//   name: 'asfi.sid',   // unique cookie name
//   secret: process.env.SESSION_SECRET , // dedicated secret
//   store: sessionStore,
//   resave: false,
//   saveUninitialized: false,
//   proxy: true,
//   cookie: {
//     secure: process.env.NODE_ENV === 'production',  // only secure in production
//     sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
//     maxAge: 24 * 60 * 60 * 1000,
//     httpOnly: true
//   }
// }));

// In your server.js session configuration
app.use(session({
  name: 'asfi.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    domain: process.env.NODE_ENV === 'production' ? '.asfirj.org' : undefined // Add this for subdomain support
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
  LogAction('Session ID:', req.sessionID);
  LogAction('User in session:', req.session.user ? req.session.user.email : 'None');
  next();
});

// View engine and static files
app.set("view engine", "ejs");
app.set("views", ["./views", "./views/editors", "./views/authors", "./views/reviewers", "./views/co-authors"]);
app.use("/css", express.static(path.join(__dirname, "public/css")));
app.use("/fonts", express.static(path.join(__dirname, "public/css/fonts")));
app.use("/js", express.static(path.join(__dirname, "public/js")));
app.use("/assets", express.static(path.join(__dirname, "public/assets")));
app.use("/editorStatic/", express.static(path.join(__dirname, "public/editors")));
app.use("/useruploads/", express.static(path.join(__dirname, "/useruploads/")));
app.use("/uploads/", express.static(path.join(__dirname, "/uploads/")));


app.use("/useruploads/editors/", express.static(path.join(__dirname, "/useruploads/editors")));



// Routes
app.use("/manuscript", require("./routes/submissionRoutes"))
app.use("/publications", require("./routes/manageSupplements"))
app.use("/inbox/api", require("./routes/inbox.routes"))
app.use("/api/newsletter", require("./routes/newsletter.routes"))
app.use("/api/semperfi", require("./routes/admin.invitations"))
app.use("/api/personnel", require("./routes/invitationRoutes"))
app.use("/api/authors", require("./routes/authorsRoutes"))
app.use("/authorsRoutes", require("./routes/authorsRoutes"))

app.use("/reviewer", require("./routes/reviewerRoutes"))
app.use("/journal/public", require("./routes/externalRoutes"))



app.use("/", require("./routes/pages"));

server.listen(PORT, () => {
  LogAction("Server is running on ", PORT);
  LogAction("Environment:", process.env.NODE_ENV || 'development');
});
