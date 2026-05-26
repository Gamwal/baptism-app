const express  = require('express');
const { getDb }        = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/interviews/stats  (must be before /:registrationId routes)
router.get('/stats', (req, res, next) => {
  try {
    const db  = getDb();
    const row = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled,
        SUM(CASE WHEN status = 'certified' THEN 1 ELSE 0 END) AS certified,
        SUM(CASE WHEN status = 'declined'  THEN 1 ELSE 0 END) AS declined
      FROM registrations
    `).get();
    res.json({ stats: row });
  } catch (err) { next(err); }
});

// POST /api/interviews/:registrationId/comments
router.post('/:registrationId/comments', (req, res, next) => {
  try {
    const db = getDb();
    const { comment } = req.body;

    if (!comment?.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const reg = db
      .prepare('SELECT id, status FROM registrations WHERE id = ?')
      .get(req.params.registrationId);

    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    if (reg.status === 'certified' || reg.status === 'declined') {
      return res.status(409).json({ error: 'Cannot comment on a closed registration' });
    }

    if (reg.status === 'pending') {
      db.prepare("UPDATE registrations SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(reg.id);
    }

    const result = db.prepare(
      'INSERT INTO interview_comments (registration_id, interviewer_id, comment) VALUES (?, ?, ?)'
    ).run(reg.id, req.user.id, comment.trim());

    const newComment = db.prepare(`
      SELECT c.*, i.name AS interviewer_name
      FROM interview_comments c
      JOIN interviewers i ON i.id = c.interviewer_id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ comment: newComment });
  } catch (err) { next(err); }
});

// PATCH /api/interviews/:registrationId/certify
router.patch('/:registrationId/certify', (req, res, next) => {
  try {
    const db = getDb();
    const { comment } = req.body;

    const reg = db
      .prepare('SELECT id, status FROM registrations WHERE id = ?')
      .get(req.params.registrationId);

    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    if (reg.status === 'certified') return res.status(409).json({ error: 'Already certified' });

    if (comment?.trim()) {
      db.prepare('INSERT INTO interview_comments (registration_id, interviewer_id, comment) VALUES (?, ?, ?)')
        .run(reg.id, req.user.id, comment.trim());
    }

    db.prepare(`
      UPDATE registrations SET status = 'certified', interviewer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.user.id, reg.id);

    const updated = db.prepare(`
      SELECT r.*, i.name AS interviewer_name
      FROM registrations r LEFT JOIN interviewers i ON i.id = r.interviewer_id
      WHERE r.id = ?
    `).get(reg.id);

    res.json({ registration: updated });
  } catch (err) { next(err); }
});

// PATCH /api/interviews/:registrationId/decline
router.patch('/:registrationId/decline', (req, res, next) => {
  try {
    const db = getDb();
    const { comment } = req.body;

    const reg = db
      .prepare('SELECT id, status FROM registrations WHERE id = ?')
      .get(req.params.registrationId);

    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    if (comment?.trim()) {
      db.prepare('INSERT INTO interview_comments (registration_id, interviewer_id, comment) VALUES (?, ?, ?)')
        .run(reg.id, req.user.id, comment.trim());
    }

    db.prepare(`
      UPDATE registrations SET status = 'declined', interviewer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.user.id, reg.id);

    const updated = db.prepare(`
      SELECT r.*, i.name AS interviewer_name
      FROM registrations r LEFT JOIN interviewers i ON i.id = r.interviewer_id
      WHERE r.id = ?
    `).get(reg.id);

    res.json({ registration: updated });
  } catch (err) { next(err); }
});

module.exports = router;
