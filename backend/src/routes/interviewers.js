const express = require('express');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const { pool }                   = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

// Alphabet avoids visually ambiguous characters (0/O, 1/l/I) for a password
// that's read off a screen and typed by hand.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generateTempPassword(length = 10) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return out;
}

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

// PATCH /api/interviewers/:id/reset-password
// Generates a new random temporary password, stores its hash, and returns
// the plaintext once so the admin can hand it to the interviewer. It is
// never stored or logged in plaintext anywhere.
router.patch('/:id/reset-password', async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      'SELECT id, name, email FROM interviewers WHERE id = $1', [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Interviewer not found.' });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    await pool.query('UPDATE interviewers SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);

    res.json({ tempPassword, interviewer: existing[0] });
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
