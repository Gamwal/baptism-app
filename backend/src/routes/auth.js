const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool }          = require('../db');
const { authenticate }  = require('../middleware/auth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'change-this-in-production';

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const { rows } = await pool.query(
      'SELECT * FROM interviewers WHERE email = $1', [email]
    );
    const interviewer = rows[0];
    if (!interviewer)
      return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, interviewer.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: interviewer.id, name: interviewer.name, email: interviewer.email, role: interviewer.role },
      SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      interviewer: { id: interviewer.id, name: interviewer.name, email: interviewer.email, role: interviewer.role },
    });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ interviewer: req.user });
});

// PATCH /api/auth/password — change own password
router.patch('/password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Current password and new password are required.' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    if (newPassword === currentPassword)
      return res.status(400).json({ error: 'New password must be different from the current one.' });

    const { rows } = await pool.query(
      'SELECT id, password_hash FROM interviewers WHERE id = $1', [req.user.id]
    );
    const me = rows[0];
    if (!me) return res.status(404).json({ error: 'Account not found.' });

    const ok = await bcrypt.compare(currentPassword, me.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE interviewers SET password_hash = $1 WHERE id = $2', [newHash, me.id]);

    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
