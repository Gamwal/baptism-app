const express  = require('express');
const { pool }         = require('../db');
const { authenticate } = require('../middleware/auth');
const { getFreeSlotsForDate } = require('../utils/scheduler');
const { notify } = require('../utils/notifier');

const router = express.Router();
router.use(authenticate);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const UNIQUE_VIOLATION = '23505';

// GET /api/interviews/free-slots?date=YYYY-MM-DD&excludeRegistrationId=123
// Used by the reschedule UI. excludeRegistrationId lets a registration's own
// current slot show up as "free" when rescheduling it within the same date.
router.get('/free-slots', async (req, res, next) => {
  try {
    const { date, excludeRegistrationId } = req.query;
    if (!date || !DATE_RE.test(date))
      return res.status(400).json({ error: 'A valid date (YYYY-MM-DD) is required.' });

    const { allowedDay, times } = await getFreeSlotsForDate(
      pool, date, excludeRegistrationId || null
    );
    res.json({ date, allowedDay, times });
  } catch (err) { next(err); }
});

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

// PATCH /api/interviews/:registrationId/reschedule
router.patch('/:registrationId/reschedule', async (req, res, next) => {
  try {
    const { date, time } = req.body;
    if (!date || !DATE_RE.test(date) || !time || !TIME_RE.test(time))
      return res.status(400).json({ error: 'A valid date (YYYY-MM-DD) and time (HH:MM) are required.' });

    const { rows } = await pool.query(
      'SELECT id, reg_number, status, interview_date, interview_time FROM registrations WHERE id = $1',
      [req.params.registrationId]
    );
    const reg = rows[0];
    if (!reg) return res.status(404).json({ error: 'Registration not found' });
    if (reg.status === 'certified' || reg.status === 'declined')
      return res.status(409).json({ error: 'Cannot reschedule a closed registration' });

    const { allowedDay, times } = await getFreeSlotsForDate(pool, date, reg.id);
    if (!allowedDay)
      return res.status(400).json({ error: 'Interviews are not held on that day of the week.' });
    if (!times.includes(time))
      return res.status(409).json({ error: 'That slot is no longer free — please pick another.' });

    try {
      await pool.query(
        'UPDATE registrations SET interview_date = $1, interview_time = $2, updated_at = NOW() WHERE id = $3',
        [date, time, reg.id]
      );
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION && err.constraint === 'uq_reg_slot')
        return res.status(409).json({ error: 'That slot was just taken by another candidate — please pick another.' });
      throw err;
    }

    await pool.query(
      'INSERT INTO interview_comments (registration_id, interviewer_id, comment) VALUES ($1, $2, $3)',
      [reg.id, req.user.id,
        `Rescheduled from ${reg.interview_date} ${reg.interview_time} to ${date} ${time} by ${req.user.name}.`]
    );

    notify('interview.rescheduled', {
      registrationId: reg.id, regNumber: reg.reg_number,
      fromDate: reg.interview_date, fromTime: reg.interview_time,
      toDate: date, toTime: time, byInterviewerId: req.user.id,
    }).catch(() => {});

    const { rows: updated } = await pool.query(`
      SELECT r.*, iv.name AS interviewer_name FROM registrations r
      LEFT JOIN interviewers iv ON iv.id = r.interviewer_id WHERE r.id = $1
    `, [reg.id]);

    res.json({ registration: updated[0] });
  } catch (err) { next(err); }
});

// PATCH /api/interviews/:registrationId/certify
router.patch('/:registrationId/certify', async (req, res, next) => {
  try {
    const { comment } = req.body;
    const { rows } = await pool.query(
      'SELECT id, status, reg_number FROM registrations WHERE id = $1', [req.params.registrationId]
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

    notify('candidate.certified', {
      registrationId: reg.id, regNumber: reg.reg_number, byInterviewerId: req.user.id,
    }).catch(() => {});

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
      'SELECT id, status, reg_number FROM registrations WHERE id = $1', [req.params.registrationId]
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

    notify('candidate.declined', {
      registrationId: reg.id, regNumber: reg.reg_number, byInterviewerId: req.user.id,
    }).catch(() => {});

    const { rows: updated } = await pool.query(`
      SELECT r.*, iv.name AS interviewer_name FROM registrations r
      LEFT JOIN interviewers iv ON iv.id = r.interviewer_id WHERE r.id = $1
    `, [reg.id]);

    res.json({ registration: updated[0] });
  } catch (err) { next(err); }
});

module.exports = router;
