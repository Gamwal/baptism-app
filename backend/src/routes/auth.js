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

module.exports = router;
