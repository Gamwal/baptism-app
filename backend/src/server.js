require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const authRoutes          = require('./routes/auth');
const registrationRoutes  = require('./routes/registrations');
const interviewRoutes     = require('./routes/interviews');
const interviewerRoutes   = require('./routes/interviewers');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',           authRoutes);
app.use('/api/registrations',  registrationRoutes);
app.use('/api/interviews',     interviewRoutes);
app.use('/api/interviewers',   interviewerRoutes);

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date() }));

// ── Serve React build (production) ──────────────────────────────────────────
const CLIENT_BUILD = path.join(__dirname, '../../client/dist');
if (fs.existsSync(CLIENT_BUILD)) {
  app.use(express.static(CLIENT_BUILD));
  app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_BUILD, 'index.html')));
} else {
  app.get('/', (_req, res) =>
    res.json({ message: 'API running. Build the React client and place dist/ beside backend/.' })
  );
}

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`Baptism Registry running on http://localhost:${PORT}`));
