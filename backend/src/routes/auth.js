const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { getDb }       = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'change-this-in-production';

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, interviewer }
 */
router.post('/login', (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDb();
    const interviewer = db
      .prepare('SELECT * FROM interviewers WHERE email = ?')
      .get(email);

    if (!interviewer) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, interviewer.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: interviewer.id, name: interviewer.name, email: interviewer.email, role: interviewer.role },
      SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      interviewer: { id: interviewer.id, name: interviewer.name, email: interviewer.email, role: interviewer.role }
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/auth/me  (protected)
 * Returns the logged-in interviewer's profile
 */
router.get('/me', authenticate, (req, res) => {
  res.json({ interviewer: req.user });
});

module.exports = router;
