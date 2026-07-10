require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const path        = require('path');
const fs          = require('fs');
const rateLimit   = require('express-rate-limit');
const pinoHttp    = require('pino-http');

require('./config'); // fail fast at boot if JWT_SECRET is missing in production
const logger = require('./logger');

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === '/api/health' },
}));

// ── Rate limiting on abuse-prone public endpoints ────────────────────────────
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts from this connection. Please try again later.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const trackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many lookups. Please try again later.' },
});

app.use('/api/registrations', (req, res, next) =>
  req.method === 'POST' ? registrationLimiter(req, res, next) : next());
app.use('/api/auth/login', loginLimiter);
app.use('/api/registrations/track', trackLimiter);

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/interviews',    require('./routes/interviews'));
app.use('/api/interviewers',  require('./routes/interviewers'));
app.use('/api/church',        require('./routes/church'));
app.use('/api/settings',      require('./routes/settings'));

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date() }));

// Unknown API routes get a real 404 instead of silently falling through to
// the SPA catch-all below (which would return index.html with a 200).
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Serve React build locally (skipped on Vercel — it serves static files natively) ──
if (!process.env.VERCEL) {
  const CLIENT_BUILD = path.join(__dirname, '../../client/dist');
  if (fs.existsSync(CLIENT_BUILD)) {
    app.use(express.static(CLIENT_BUILD));
    app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_BUILD, 'index.html')));
  }
}

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  (req.log || logger).error({ err, path: req.originalUrl, method: req.method }, err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start server when run directly (not when imported by Vercel) ─────────────
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => logger.info(`Baptism Registry running on http://localhost:${PORT}`));
}

module.exports = app;
