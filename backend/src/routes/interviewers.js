const express = require('express');
const bcrypt  = require('bcryptjs');
const { getDb } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin); // all routes: logged-in admin only

// GET /api/interviewers — list all
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT id, name, email, role, created_at FROM interviewers ORDER BY created_at ASC'
    ).all();
    res.json({ interviewers: rows });
  } catch (err) { next(err); }
});

// POST /api/interviewers — create new
router.post('/', (req, res, next) => {
  try {
    const { name, email, password, role = 'interviewer' } = req.body;

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (!['interviewer', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "interviewer" or "admin".' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM interviewers WHERE email = ?').get(email.trim());
    if (existing) {
      return res.status(409).json({ error: 'An interviewer with that email already exists.' });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO interviewers (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), email.trim().toLowerCase(), password_hash, role);

    const created = db.prepare(
      'SELECT id, name, email, role, created_at FROM interviewers WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json({ interviewer: created });
  } catch (err) { next(err); }
});

// DELETE /api/interviewers/:id
router.delete('/:id', (req, res, next) => {
  try {
    const db = getDb();

    // Prevent deleting yourself
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const result = db.prepare('DELETE FROM interviewers WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Interviewer not found.' });

    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
