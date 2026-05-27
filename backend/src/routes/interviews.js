const express  = require('express');
const { pool }         = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/interviews/stats  (must come before /:id routes)
router.get('/stats', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::integer                                                 AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::integer              AS pending,
        COUNT(*) FILTER (WHERE status = 'scheduled')::integer            AS scheduled,
        COUNT(*) FILTER (WHERE status = 'certified')::integer            AS certified,
        COUNT(*) FILTER (WHERE status = 'declined')::integer             AS declined
      FROM registrations
    `);
    res.json({ stats: rows[0] });
  } catch (err) { next(err); }
});

// POST /api/interviews/:registrationId/comments
router.post('/:registrationId/comments', async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment?.trim())
      return res.status(400).json({ error: 'Comment text is required' });

    const { rows } = await pool.query(
      'SELECT id, status FROM registrations WHERE id = $1', [req.params.registrationId]
    );
    const reg = rows[0];
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    if (reg.status === 'certified' || reg.status === 'declined')
      return res.status(409).json({ error: 'Cannot comment on a closed registration' });

    if (reg.status === 'pending') {
      await pool.query(
        "UPDATE registrations SET status = 'scheduled', updated_at = NOW() WHERE id = $1",
        [reg.id]
      );
    }

    const { rows: inserted } = await pool.query(
      'INSERT INTO interview_comments (registration_id, interviewer_id, comment) VALUES ($1, $2, $3) RETURNING id',
      [reg.id, req.user.id, comment.trim()]
    );

    const { rows: newComment } = await pool.query(`
      SELECT c.*, iv.name AS interviewer_name
      FROM interview_comments c
      JOIN interviewers iv ON iv.id = c.interviewer_id
      WHERE c.id = $1
    `, [inserted[0].id]);

    res.status(201).json({ comment: newComment[0] });
  } catch (err) { next(err); }
});

// PATCH /api/interviews/:registrationId/certify
router.patch('/:registrationId/certify', async (req, res, next) => {
  try {
    const { comment } = req.body;
    const { rows } = await pool.query(
      'SELECT id, status FROM registrations WHERE id = $1', [req.params.registrationId]
    );
    const reg = rows[0];
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    if (reg.status === 'certified') return res.status(409).json({ error: 'Already certified' });

    if (comment?.trim()) {
      await pool.query(
        'INSERT INTO interview_comments (registration_id, interviewer_id, comment) VALUES ($1, $2, $3)',
        [reg.id, req.user.id, comment.trim()]
      );
    }
    await pool.query(
      "UPDATE registrations SET status = 'certified', interviewer_id = $1, updated_at = NOW() WHERE id = $2",
      [req.user.id, reg.id]
    );

    const { rows: updated } = await pool.query(`
      SELECT r.*, iv.name AS interviewer_name FROM registrations r
      LEFT JOIN interviewers iv ON iv.id = r.interviewer_id WHERE r.id = $1
    `, [reg.id]);

    res.json({ registration: updated[0] });
  } catch (err) { next(err); }
});

// PATCH /api/interviews/:registrationId/decline
router.patch('/:registrationId/decline', async (req, res, next) => {
  try {
    const { comment } = req.body;
    const { rows } = await pool.query(
      'SELECT id, status FROM registrations WHERE id = $1', [req.params.registrationId]
    );
    const reg = rows[0];
    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    if (comment?.trim()) {
      await pool.query(
        'INSERT INTO interview_comments (registration_id, interviewer_id, comment) VALUES ($1, $2, $3)',
        [reg.id, req.user.id, comment.trim()]
      );
    }
    await pool.query(
      "UPDATE registrations SET status = 'declined', interviewer_id = $1, updated_at = NOW() WHERE id = $2",
      [req.user.id, reg.id]
    );

    const { rows: updated } = await pool.query(`
      SELECT r.*, iv.name AS interviewer_name FROM registrations r
      LEFT JOIN interviewers iv ON iv.id = r.interviewer_id WHERE r.id = $1
    `, [reg.id]);

    res.json({ registration: updated[0] });
  } catch (err) { next(err); }
});

module.exports = router;
