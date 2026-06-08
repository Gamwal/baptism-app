const express = require('express');
const router  = express.Router();
const { pool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const VALID_SLOT_MINUTES = [10, 15, 20, 30, 45, 60];

// GET /api/settings — any authenticated interviewer can read the current config
router.get('/', authenticate, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT slot_minutes, start_hour, end_hour, lead_days, days_of_week, updated_at FROM interview_settings WHERE id = 1'
    );
    res.json({ settings: rows[0] || null });
  } catch (err) { next(err); }
});

// PATCH /api/settings — admin only
router.patch('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { slotMinutes, startHour, endHour, leadDays, daysOfWeek } = req.body;

    if (!VALID_SLOT_MINUTES.includes(slotMinutes))
      return res.status(400).json({ error: `Slot minutes must be one of: ${VALID_SLOT_MINUTES.join(', ')}` });
    if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23)
      return res.status(400).json({ error: 'Start hour must be 0–23' });
    if (!Number.isInteger(endHour) || endHour <= startHour || endHour > 24)
      return res.status(400).json({ error: 'End hour must be greater than start hour and at most 24' });
    if (!Number.isInteger(leadDays) || leadDays < 0)
      return res.status(400).json({ error: 'Lead days must be 0 or more' });
    const days = Array.isArray(daysOfWeek)
      ? [...new Set(daysOfWeek.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
      : [];
    if (!days.length)
      return res.status(400).json({ error: 'Pick at least one day of the week' });

    await pool.query(`
      UPDATE interview_settings
      SET slot_minutes = $1, start_hour = $2, end_hour = $3,
          lead_days = $4, days_of_week = $5, updated_at = NOW()
      WHERE id = 1
    `, [slotMinutes, startHour, endHour, leadDays, days.join(',')]);

    const { rows } = await pool.query(
      'SELECT slot_minutes, start_hour, end_hour, lead_days, days_of_week, updated_at FROM interview_settings WHERE id = 1'
    );
    res.json({ settings: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
