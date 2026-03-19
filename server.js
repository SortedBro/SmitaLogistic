// ════════════════════════════════════════════
//  SmitaLogistic — server.js
//  EJS + MongoDB + Delhivery
// ════════════════════════════════════════════
require('dotenv').config();

const express        = require('express');
const session        = require('express-session');
const flash          = require('connect-flash');
const methodOverride = require('method-override');
const cors           = require('cors');
const path           = require('path');

const connectDB      = require('./config/db');
const pageRoutes     = require('./routes/pages');
const adminRoutes    = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database ──────────────────────────────────
connectDB();

// ── View Engine ───────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ────────────────────────────────
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret           : process.env.SESSION_SECRET || 'smita_secret',
  resave           : false,
  saveUninitialized: false,
  cookie           : { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// Flash messages
app.use(flash());

// Make flash available in all views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error   = req.flash('error');
  next();
});

// ── Routes ────────────────────────────────────
app.use('/',       pageRoutes);
app.use('/admin',  adminRoutes);
app.get('/ping', (req, res) => res.send('pong'));

// ── 404 Handler ───────────────────────────────
app.use((req, res) => {
  res.status(404).render('pages/home', {
    title : '404 — Page Not Found',
    page  : 'home',
    stats : {},
    success: [],
    error  : [`Page not found: ${req.path}`]
  });
});

// ── Error Handler ─────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).send('Something went wrong. Please try again.');
});

// ── Start ─────────────────────────────────────
app.listen(PORT,'0.0.0.0' ,() => {
  console.log('\n🚚 ══════════════════════════════════════');
  console.log(`   SmitaLogistic Server Started`);
  console.log(`   URL     : http://localhost:${PORT}`);
  console.log(`   Admin   : http://localhost:${PORT}/admin`);
  console.log(`   MongoDB : ${process.env.MONGO_URI}`);
  console.log(`   Delhivery: ${process.env.DELHIVERY_BASE_URL}`);
  console.log(`   Token   : ${process.env.DELHIVERY_TOKEN ? '✅ Set' : '❌ Missing!'}`);
  console.log('   ══════════════════════════════════════\n');
});