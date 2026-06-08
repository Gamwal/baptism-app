const express  = require('express');
const ExcelJS  = require('exceljs');
const { pool }                       = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getNextInterviewSlot } = require('../utils/scheduler');

const router = express.Router();

const MINOR_AGE = 18;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidPhone(phone) {
  if (!/^[\d\s+()-]+$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

async function generateRegNumber(pool) {
  const year = new Date().getFullYear();
  const { rows } = await pool.query(
    "SELECT COUNT(*)::integer AS cnt FROM registrations WHERE reg_number LIKE $1",
    [`WB-${year}-%`]
  );
  const seq = String((rows[0].cnt || 0) + 1).padStart(5, '0');
  return `WB-${year}-${seq}`;
}

/** Whole-year age from a YYYY-MM-DD string, or null if invalid. */
function calcAge(dob) {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

// POST /api/registrations  (public)
router.post('/', async (req, res, next) => {
  try {
    const {
      fullName, gender, dateOfBirth, maritalStatus,
      residentialAddress, phoneNumber, email, occupation,
      nationality, stateOfOrigin,
      branchChurch, branchChurchId, zone, zoneId, area, areaId, groupPastorName,
      hasSalvation, salvationDate, salvationExperience,
      hasSanctification, sanctificationDate, sanctificationExperience,
      hasHolyGhost, holyGhostDate, holyGhostBaptism,
      previouslyBaptized, prevChurchName, prevModeOfBaptism, prevBaptismDate,
      guardianName, guardianPhone, guardianConsent, guardianSignature,
    } = req.body;

    // Age and minor status are derived from DOB on the server (not trusted from client)
    const age     = calcAge(dateOfBirth);
    const isMinor = age != null && age < MINOR_AGE;

    const missing = [];
    if (!fullName?.trim())           missing.push('Full Name');
    if (!gender)                     missing.push('Gender');
    if (!dateOfBirth || age == null) missing.push('Valid Date of Birth');
    if (!maritalStatus)              missing.push('Marital Status');
    if (!residentialAddress?.trim()) missing.push('Residential Address');
    if (!phoneNumber?.trim())        missing.push('Phone Number');
    if (!branchChurch?.trim())       missing.push('Branch Church');
    if (isMinor) {
      if (!guardianName?.trim())  missing.push('Guardian Name');
      if (!guardianPhone?.trim()) missing.push('Guardian Phone');
      if (!guardianConsent)       missing.push('Guardian Consent');
    }
    if (missing.length)
      return res.status(400).json({ error: `Required fields missing: ${missing.join(', ')}` });

    // Format checks (phone required, email optional)
    if (!isValidPhone(phoneNumber.trim()))
      return res.status(400).json({ error: 'Please enter a valid phone number.' });
    if (email?.trim() && !EMAIL_RE.test(email.trim()))
      return res.status(400).json({ error: 'Please enter a valid email address.' });

    // Each checked experience needs a date (description is optional)
    if (hasSalvation && !salvationDate)
      return res.status(400).json({ error: 'Salvation experience needs a date.' });
    if (hasSanctification && !sanctificationDate)
      return res.status(400).json({ error: 'Sanctification experience needs a date.' });
    if (hasHolyGhost && !holyGhostDate)
      return res.status(400).json({ error: 'Holy Ghost baptism needs a date.' });

    // Experiences must be chronological: Salvation → Sanctification → Holy Ghost
    const orderedDates = [
      hasSalvation      && salvationDate      ? salvationDate      : null,
      hasSanctification && sanctificationDate ? sanctificationDate : null,
      hasHolyGhost      && holyGhostDate      ? holyGhostDate      : null,
    ].filter(Boolean);
    for (let k = 1; k < orderedDates.length; k++) {
      if (orderedDates[k] < orderedDates[k - 1])
        return res.status(400).json({
          error: 'Experience dates must follow the order: Salvation → Sanctification → Holy Ghost Baptism.',
        });
    }

    const regNumber = await generateRegNumber(pool);
    const { interviewDate, interviewTime } = await getNextInterviewSlot(pool);

    const { rows } = await pool.query(`
      INSERT INTO registrations (
        reg_number,
        full_name, gender, date_of_birth, age, marital_status,
        residential_address, phone_number, email, occupation, nationality, state_of_origin,
        branch_church, branch_id, zone, zone_id, area, area_id, group_pastor_name,
        salvation_experience, salvation_date,
        sanctification_experience, sanctification_date,
        holy_ghost_baptism, holy_ghost_date,
        previously_baptized, prev_church_name, prev_mode_of_baptism, prev_baptism_date,
        is_minor, guardian_name, guardian_phone, guardian_consent, guardian_signature,
        interview_date, interview_time
      ) VALUES (
        $1,
        $2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,$18,$19,
        $20,$21,
        $22,$23,
        $24,$25,
        $26,$27,$28,$29,
        $30,$31,$32,$33,$34,
        $35,$36
      ) RETURNING id
    `, [
      regNumber,
      fullName.trim(), gender, dateOfBirth || null, age != null ? String(age) : null, maritalStatus,
      residentialAddress.trim(), phoneNumber.trim(), email?.trim() || null,
      occupation?.trim() || null, nationality?.trim() || null, stateOfOrigin?.trim() || null,
      branchChurch.trim(), branchChurchId?.trim() || null,
      zone?.trim() || null, zoneId?.trim() || null,
      area?.trim() || null, areaId?.trim() || null,
      groupPastorName?.trim() || null,
      hasSalvation ? (salvationExperience?.trim() || null) : null,           hasSalvation ? salvationDate : null,
      hasSanctification ? (sanctificationExperience?.trim() || null) : null, hasSanctification ? sanctificationDate : null,
      hasHolyGhost ? (holyGhostBaptism?.trim() || null) : null,              hasHolyGhost ? holyGhostDate : null,
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

// GET /api/registrations/export  (admin only — Excel spool of every column)
router.get('/export', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.*, iv.name AS interviewer_name
      FROM registrations r
      LEFT JOIN interviewers iv ON iv.id = r.interviewer_id
      ORDER BY r.created_at DESC
    `);

    const wb = new ExcelJS.Workbook();
    wb.creator     = 'Water Baptism Registry';
    wb.created     = new Date();
    const ws = wb.addWorksheet('Registrations');

    ws.columns = [
      { header: 'Reg Number',          key: 'reg_number',                width: 18 },
      { header: 'Status',              key: 'status',                    width: 12 },
      { header: 'Full Name',           key: 'full_name',                 width: 28 },
      { header: 'Gender',              key: 'gender',                    width: 10 },
      { header: 'Date of Birth',       key: 'date_of_birth',             width: 14 },
      { header: 'Age',                 key: 'age',                       width: 8  },
      { header: 'Marital Status',      key: 'marital_status',            width: 14 },
      { header: 'Phone',               key: 'phone_number',              width: 18 },
      { header: 'Email',               key: 'email',                     width: 26 },
      { header: 'Occupation',          key: 'occupation',                width: 20 },
      { header: 'Address',             key: 'residential_address',       width: 36 },
      { header: 'Nationality',         key: 'nationality',               width: 14 },
      { header: 'State of Origin',     key: 'state_of_origin',           width: 16 },
      { header: 'Area',                key: 'area',                      width: 16 },
      { header: 'Zone',                key: 'zone',                      width: 16 },
      { header: 'Branch Church',       key: 'branch_church',             width: 22 },
      { header: 'Group / Pastor',      key: 'group_pastor_name',         width: 22 },
      { header: 'Salvation Date',      key: 'salvation_date',            width: 14 },
      { header: 'Salvation',           key: 'salvation_experience',      width: 40 },
      { header: 'Sanctification Date', key: 'sanctification_date',       width: 14 },
      { header: 'Sanctification',      key: 'sanctification_experience', width: 40 },
      { header: 'Holy Ghost Date',     key: 'holy_ghost_date',           width: 14 },
      { header: 'Holy Ghost Baptism',  key: 'holy_ghost_baptism',        width: 40 },
      { header: 'Previously Baptized', key: 'previously_baptized',       width: 18 },
      { header: 'Prev. Church',        key: 'prev_church_name',          width: 22 },
      { header: 'Prev. Mode',          key: 'prev_mode_of_baptism',      width: 14 },
      { header: 'Prev. Date',          key: 'prev_baptism_date',         width: 14 },
      { header: 'Is Minor',            key: 'is_minor',                  width: 10 },
      { header: 'Guardian Name',       key: 'guardian_name',             width: 22 },
      { header: 'Guardian Phone',      key: 'guardian_phone',            width: 18 },
      { header: 'Guardian Consent',    key: 'guardian_consent',          width: 16 },
      { header: 'Interview Date',      key: 'interview_date',            width: 14 },
      { header: 'Interview Time',      key: 'interview_time',            width: 12 },
      { header: 'Interviewer',         key: 'interviewer_name',          width: 22 },
      { header: 'Registered At',       key: 'created_at',                width: 22 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    for (const r of rows) {
      ws.addRow({
        ...r,
        previously_baptized: r.previously_baptized ? 'Yes' : 'No',
        is_minor:            r.is_minor ? 'Yes' : 'No',
        guardian_consent:    r.guardian_consent ? 'Yes' : 'No',
      });
    }

    const fileName = `baptism-registrations-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await wb.xlsx.write(res);
    res.end();
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
