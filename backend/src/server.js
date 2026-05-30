require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/interviews',    require('./routes/interviews'));
app.use('/api/interviewers',  require('./routes/interviewers'));
app.use('/api/church',        require('./routes/church'));

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date() }));

// ── Serve React build locally (skipped on Vercel — it serves static files natively) ──
if (!process.env.VERCEL) {
  const CLIENT_BUILD = path.join(__dirname, '../../client/dist');
  if (fs.existsSync(CLIENT_BUILD)) {
    app.use(express.static(CLIENT_BUILD));
    app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_BUILD, 'index.html')));
  }
}

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start server when run directly (not when imported by Vercel) ─────────────
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Baptism Registry running on http://localhost:${PORT}`));
}

module.exports = app;
