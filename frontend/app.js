const User = require('./models/User');
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const morgan = require('morgan');
const flash = require('express-flash');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(flash());

app.use(session({
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  const user = {
    id: profile.id,
    displayName: profile.displayName,
    email: profile.emails?.[0]?.value,
    provider: 'google'
  };
  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

function authenticateJWT(req, res, next) {
  const token = req.cookies.jwt;
  if (!token) return res.redirect('/login');
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.redirect('/login');
    req.user = decoded;
    next();
  });
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.redirect('/login');
    }
    next();
  };
}

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/index');
  }
);

const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000
    });
    console.log('MongoDB Connected Successfully');
    await initializeDB();
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  }
};

async function initializeDB() {
  try {
    await User.deleteMany({});

    const adminHash = await bcrypt.hash('123', 10);
    const workerHash = await bcrypt.hash('123', 10);

    await User.create({ username: 'admin', password: adminHash, role: 'admin' });
    for (let i = 1; i <= 10; i++) {
      await User.create({ username: `worker${i}`, password: workerHash, role: 'worker' });
    }
  } catch (err) {
    console.error('❌ Database initialization failed:', err);
    process.exit(1);
  }
}

app.get('/', (req, res) => {
  const token = req.cookies.jwt;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin') return res.redirect('/dashboard');
      if (decoded.role === 'worker') return res.redirect('/alerts');
    } catch {
      res.clearCookie('jwt');
    }
  }

  if (req.isAuthenticated() && req.user?.provider === 'google') {
    return res.render('index', { user: req.user });
  }

  res.render('login', { error: req.flash('error') });
});

app.get('/login', (req, res) => {
  res.render('login', { error: req.flash('error') });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user) {
      req.flash('error', 'Invalid username or password');
      return res.redirect('/login');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.flash('error', 'Invalid username or password');
      return res.redirect('/login');
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('jwt', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });

    return user.role === 'admin'
      ? res.redirect('/dashboard')
      : res.redirect('/alerts');

  } catch (err) {
    console.error('Login error:', err);
    req.flash('error', 'Login failed. Please try again.');
    return res.redirect('/login');
  }
});

// Routes
app.get('/', (req, res) => {
  const token = req.cookies.jwt;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role === 'admin') return res.redirect('/dashboard');
      if (decoded.role === 'worker') return res.redirect('/alerts');
    } catch {
      res.clearCookie('jwt');
    }
  }

  if (req.isAuthenticated() && req.user?.provider === 'google') {
    return res.render('index', { user: req.user });
  }

  res.render('login', { error: req.flash('error') });
});

app.get('/login', (req, res) => {
  res.render('login', { error: req.flash('error') });
});

app.get('/dashboard', authenticateJWT, requireRole('admin'), (req, res) => {
  res.render('dashboard', { user: req.user });
});

app.get('/map', authenticateJWT, requireRole('admin'), (req, res) => {
  res.render('map', { user: req.user });
});

app.get('/alert', authenticateJWT, (req, res) => {
  if (req.user.role === 'admin' || req.user.role === 'worker') {
    res.render('alert', { user: req.user }); // Make sure alert.ejs exists
  } else {
    res.redirect('/login');
  }
});

app.get('/routes', authenticateJWT, (req, res) => {
  if (req.user.role === 'admin' || req.user.role === 'worker') {
    res.render('routes', { user: req.user }); // Make sure routes.ejs exists
  } else {
    res.redirect('/login');
  }
});

app.get('/map', authenticateJWT, (req, res) => {
  if (req.user.role === 'admin' || req.user.role === 'worker') {
    res.render('map', { user: req.user }); // Make sure routes.ejs exists
  } else {
    res.redirect('/login');
  }
});

app.get('/reports', authenticateJWT, requireRole('admin'), (req, res) => {
  res.render('reports', { user: req.user });
});

app.get('/alerts', authenticateJWT, requireRole('worker'), (req, res) => {
  res.render('alert', { user: req.user }); // Same view as admin sees
});

// Google OAuth user route
app.get('/index', (req, res) => {
  if (req.isAuthenticated() && req.user?.provider === 'google') {
    return res.render('index', { user: req.user });
  }
  res.redirect('/login');
});

// Logout
app.get('/logout', (req, res) => {
  res.clearCookie('jwt');
  req.logout(() => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

const apiRouter = require('./routes/api');
const viewsRouter = require('./routes/views');

app.use('/api', apiRouter);
app.use('/', viewsRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { error: err.message });
});

// Start
connectDB().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
    console.log('\nTest logins:');
    console.log('Admin: username: admin, password: 123');
    console.log('Workers: username: worker1-worker10, password: 123');
  });
});
