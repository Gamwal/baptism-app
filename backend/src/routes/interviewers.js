const express = require('express');
const bcrypt  = require('bcryptjs');
const { pool }                   = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

// GET /api/interviewers
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, created_at FROM interviewers ORDER BY created_at ASC'
    );
    res.json({ interviewers: rows });
  } catch (err) { next(err); }
});

// POST /api/interviewers
router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role = 'interviewer' } = req.body;
    if (!name?.trim() || !email?.trim() || !password?.trim())
      return res.status(400).json({ error: 'Name, email and password are required.' });
    if (!['interviewer', 'admin'].includes(role))
      return res.status(400).json({ error: 'Role must be "interviewer" or "admin".' });

    const { rows: existing } = await pool.query(
      'SELECT id FROM interviewers WHERE email = $1', [email.trim()]
    );
    if (existing.length)
      return res.status(409).json({ error: 'An interviewer with that email already exists.' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO interviewers (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
      [name.trim(), email.trim().toLowerCase(), hash, role]
    );
    res.status(201).json({ interviewer: rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/interviewers/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (Number(req.params.id) === req.user.id)
      return res.status(400).json({ error: 'You cannot delete your own account.' });

    const { rowCount } = await pool.query('DELETE FROM interviewers WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Interviewer not found.' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
