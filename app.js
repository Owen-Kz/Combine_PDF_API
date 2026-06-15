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
const multer = require("multer")
// Trust proxy (important for shared/proxy hosting)
app.set('trust proxy', 1);

// CORS configuration - REPLACE your existing corsOptions with this
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow all asfirj.org subdomains dynamically
    const isAllowed = 
      origin === 'https://portal.asfirj.org' ||
      origin === 'https://asfirj.org' ||
      origin === 'https://process.asfirj.org' ||
      origin.match(/^https:\/\/.*\.asfirj\.org$/) || // Any subdomain
      (process.env.NODE_ENV === 'development' && origin === 'http://localhost:3000');
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.error('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Content-Length', 'X-Response-Time'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware BEFORE any routes
app.use(cors(corsOptions));

// Handle preflight requests explicitly for all routes
app.options('*', cors(corsOptions));

// Add a test endpoint to verify CORS is working
app.get('/cors-test', (req, res) => {
  res.json({ message: 'CORS is working!', origin: req.headers.origin });
});
// app.use((req, res, next) => {
//   LogAction(`Incoming request: ${req.method} ${req.url}`);
//   // res.setHeader('Access-Control-Allow-Origin', '*'); //temporarily allow all origins for testing, change to specific frontend url in production
//   // res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//   // res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
//   // res.setHeader('Access-Control-Allow-Credentials', 'true');
//   next();
// });

// Server-side - Make sure error handling is proper
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = path.join(__dirname, "../useruploads/");

        // Determine subfolder based on file type
        if (file.fieldname === 'manuscriptCover') {
            uploadPath = path.join(uploadPath, "article_images/");
        } else if (file.fieldname === 'manuscript_file') {
            uploadPath = path.join(uploadPath, "manuscripts/");
        } else {
            uploadPath = path.join(uploadPath, "misc/");
        }

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Create unique filename with timestamp
        const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '_' + uniqueSuffix + ext);
    }
});
const upload = multer({
    storage: storage,
    limits: { 
        fileSize: 1000 * 1024 * 1024, // 1GB
        fieldSize: 50 * 1024 * 1024   // 50MB for form fields
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image and document files are allowed'));
        }
    }
});

// Add proper error handling middleware for multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                status: 'error', 
                message: 'File too large. Maximum size is 1GB' 
            });
        }
        if (error.code === 'LIMIT_FIELD_SIZE') {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Field data too large' 
            });
        }
        return res.status(400).json({ 
            status: 'error', 
            message: error.message 
        });
    }
    next(error);
});
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
app.use(bodyParser.json({ limit: '1000mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true, limit: '1000mb' }));
app.use(cookie());
app.use(express.json({ limit: '1000mb' }));

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
app.use("/editorStatic", express.static(path.join(__dirname, "public/editors")));
app.use("/useruploads/", express.static(path.join(__dirname, "/useruploads/")));
// app.use("/useruploads/manuscripts", express.static(path.join(__dirname, "/useruploads/manuscripts")));
// Serve user uploaded files statically
const uploadDirectories = [
    '',  // root useruploads folder
    'manuscripts',
    'coverletters',
    'tables',
    'figures',
    'supplementary',
    'graphicabstracts',
    'trackedmanuscripts'
];

uploadDirectories.forEach(dir => {
    const routePath = dir ? `/useruploads/${dir}` : '/useruploads/';
    const staticPath = dir ? path.join(__dirname, `/useruploads/${dir}`) : path.join(__dirname, '/useruploads/');
    app.use(routePath, express.static(staticPath));
});

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
