const express  = require('express');
const { pool }               = require('../db');
const { authenticate }       = require('../middleware/auth');
const { getNextInterviewSlot } = require('../utils/scheduler');

const router = express.Router();

async function generateRegNumber(pool) {
  const year = new Date().getFullYear();
  const { rows } = await pool.query(
    "SELECT COUNT(*)::integer AS cnt FROM registrations WHERE reg_number LIKE $1",
    [`WB-${year}-%`]
  );
  const seq = String((rows[0].cnt || 0) + 1).padStart(5, '0');
  return `WB-${year}-${seq}`;
}

// POST /api/registrations  (public)
router.post('/', async (req, res, next) => {
  try {
    const {
      fullName, gender, dateOfBirth, age, maritalStatus,
      residentialAddress, phoneNumber, email, occupation,
      nationality, stateOfOrigin,
      branchChurch, zone, area, groupPastorName,
      salvationExperience, sanctificationExperience, holyGhostBaptism,
      previouslyBaptized, prevChurchName, prevModeOfBaptism, prevBaptismDate,
      isMinor, guardianName, guardianPhone, guardianConsent, guardianSignature,
    } = req.body;

    const missing = [];
    if (!fullName?.trim())           missing.push('Full Name');
    if (!gender)                     missing.push('Gender');
    if (!maritalStatus)              missing.push('Marital Status');
    if (!residentialAddress?.trim()) missing.push('Residential Address');
    if (!phoneNumber?.trim())        missing.push('Phone Number');
    if (!branchChurch?.trim())       missing.push('Branch Church');
    if (isMinor) {
      if (!guardianName?.trim())  missing.push('Guardian Name');
      if (!guardianPhone?.trim()) missing.push('Guardian Phone');
    }
    if (missing.length)
      return res.status(400).json({ error: `Required fields missing: ${missing.join(', ')}` });

    const regNumber = await generateRegNumber(pool);
    const { interviewDate, interviewTime } = await getNextInterviewSlot(pool);

    const { rows } = await pool.query(`
      INSERT INTO registrations (
        reg_number,
        full_name, gender, date_of_birth, age, marital_status,
        residential_address, phone_number, email, occupation, nationality, state_of_origin,
        branch_church, zone, area, group_pastor_name,
        salvation_experience, sanctification_experience, holy_ghost_baptism,
        previously_baptized, prev_church_name, prev_mode_of_baptism, prev_baptism_date,
        is_minor, guardian_name, guardian_phone, guardian_consent, guardian_signature,
        interview_date, interview_time
      ) VALUES (
        $1,
        $2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,
        $17,$18,$19,
        $20,$21,$22,$23,
        $24,$25,$26,$27,$28,
        $29,$30
      ) RETURNING id
    `, [
      regNumber,
      fullName.trim(), gender, dateOfBirth || null, age || null, maritalStatus,
      residentialAddress.trim(), phoneNumber.trim(), email?.trim() || null,
      occupation?.trim() || null, nationality?.trim() || null, stateOfOrigin?.trim() || null,
      branchChurch.trim(), zone?.trim() || null, area?.trim() || null, groupPastorName?.trim() || null,
      salvationExperience?.trim() || null, sanctificationExperience?.trim() || null, holyGhostBaptism?.trim() || null,
      previouslyBaptized ? 1 : 0,
      prevChurchName?.trim() || null, prevModeOfBaptism?.trim() || null, prevBaptismDate || null,
      isMinor ? 1 : 0,
      guardianName?.trim() || null, guardianPhone?.trim() || null,
      guardianConsent ? 1 : 0, guardianSignature?.trim() || null,
      interviewDate, interviewTime,
    ]);

    res.status(201).json({ regNumber, interviewDate, interviewTime, id: rows[0].id });
  } catch (err) { next(err); }
});

// GET /api/registrations  (protected)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const params = [];
    let i = 1;
    let where = 'WHERE 1=1';

    if (status && status !== 'all') {
      where += ` AND r.status = $${i++}`;
      params.push(status);
    }
    if (search) {
      where += ` AND (r.reg_number ILIKE $${i} OR r.full_name ILIKE $${i+1} OR r.phone_number ILIKE $${i+2})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      i += 3;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [{ rows }, countRes] = await Promise.all([
      pool.query(`
        SELECT r.id, r.reg_number, r.full_name, r.phone_number, r.branch_church,
               r.interview_date, r.interview_time, r.status, r.created_at,
               iv.name AS interviewer_name
        FROM registrations r
        LEFT JOIN interviewers iv ON iv.id = r.interviewer_id
        ${where}
        ORDER BY r.created_at DESC
        LIMIT $${i} OFFSET $${i+1}
      `, [...params, parseInt(limit), offset]),
      pool.query(
        `SELECT COUNT(*)::integer AS total FROM registrations r ${where}`,
        params
      ),
    ]);

    res.json({ registrations: rows, total: countRes.rows[0].total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /api/registrations/:id  (protected)
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows: regRows } = await pool.query(`
      SELECT r.*, iv.name AS interviewer_name
      FROM registrations r
      LEFT JOIN interviewers iv ON iv.id = r.interviewer_id
      WHERE r.id = $1
    `, [req.params.id]);

    if (!regRows.length) return res.status(404).json({ error: 'Registration not found' });

    const { rows: comments } = await pool.query(`
      SELECT c.*, iv.name AS interviewer_name
      FROM interview_comments c
      JOIN interviewers iv ON iv.id = c.interviewer_id
      WHERE c.registration_id = $1
      ORDER BY c.created_at ASC
    `, [regRows[0].id]);

    res.json({ registration: regRows[0], comments });
  } catch (err) { next(err); }
});

module.exports = router;
