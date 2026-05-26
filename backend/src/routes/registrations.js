const express  = require('express');
const { getDb }              = require('../db');
const { authenticate }       = require('../middleware/auth');
const { getNextInterviewSlot } = require('../utils/scheduler');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────
function generateRegNumber(db) {
  const year = new Date().getFullYear();
  const row  = db.prepare(
    "SELECT COUNT(*) AS cnt FROM registrations WHERE reg_number LIKE ?"
  ).get(`WB-${year}-%`);
  const seq = String((row.cnt || 0) + 1).padStart(5, '0');
  return `WB-${year}-${seq}`;
}

// ── Public: register a new candidate ─────────────────────────────────────────
router.post('/', (req, res, next) => {
  try {
    const db = getDb();
    const {
      // Personal
      fullName, gender, dateOfBirth, age, maritalStatus,
      residentialAddress, phoneNumber, email, occupation,
      nationality, stateOfOrigin,
      // Church
      branchChurch, zone, area, groupPastorName,
      // Spiritual
      salvationExperience, sanctificationExperience, holyGhostBaptism,
      // Previous baptism
      previouslyBaptized, prevChurchName, prevModeOfBaptism, prevBaptismDate,
      // Guardian
      isMinor, guardianName, guardianPhone, guardianConsent, guardianSignature,
    } = req.body;

    // Required field check
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

    if (missing.length) {
      return res.status(400).json({ error: `Required fields missing: ${missing.join(', ')}` });
    }

    const regNumber = generateRegNumber(db);
    const { interviewDate, interviewTime } = getNextInterviewSlot(db);

    const result = db.prepare(`
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
        ?,
        ?,?,?,?,?,
        ?,?,?,?,?,?,
        ?,?,?,?,
        ?,?,?,
        ?,?,?,?,
        ?,?,?,?,?,
        ?,?
      )
    `).run(
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
    );

    res.status(201).json({
      regNumber,
      interviewDate,
      interviewTime,
      id: result.lastInsertRowid,
    });
  } catch (err) { next(err); }
});

// ── Protected: list all registrations ────────────────────────────────────────
router.get('/', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { status, search, page = 1, limit = 50 } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      where += ' AND r.status = ?';
      params.push(status);
    }

    if (search) {
      where += ' AND (r.reg_number LIKE ? OR r.full_name LIKE ? OR r.phone_number LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const rows = db.prepare(`
      SELECT r.id, r.reg_number, r.full_name, r.phone_number, r.branch_church,
             r.interview_date, r.interview_time, r.status, r.created_at,
             i.name AS interviewer_name
      FROM registrations r
      LEFT JOIN interviewers i ON i.id = r.interviewer_id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    const { total } = db.prepare(
      `SELECT COUNT(*) AS total FROM registrations r ${where}`
    ).get(...params);

    res.json({ registrations: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// ── Protected: get single registration with comments ─────────────────────────
router.get('/:id', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const registration = db.prepare(`
      SELECT r.*, i.name AS interviewer_name
      FROM registrations r
      LEFT JOIN interviewers i ON i.id = r.interviewer_id
      WHERE r.id = ?
    `).get(req.params.id);

    if (!registration) return res.status(404).json({ error: 'Registration not found' });

    const comments = db.prepare(`
      SELECT c.*, i.name AS interviewer_name
      FROM interview_comments c
      JOIN interviewers i ON i.id = c.interviewer_id
      WHERE c.registration_id = ?
      ORDER BY c.created_at ASC
    `).all(req.params.id);

    res.json({ registration, comments });
  } catch (err) { next(err); }
});

module.exports = router;
