const express  = require('express');
const ExcelJS  = require('exceljs');
const { pool }                       = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getNextInterviewSlot, toLocalDateStr } = require('../utils/scheduler');
const { notify } = require('../utils/notifier');
const {
  MINOR_AGE, calcAge, isMinor: isMinorAge, isValidPhone, isValidEmail,
  normalizePhone, checkExperienceDateOrder,
} = require('../utils/validation');

const router = express.Router();

const UNIQUE_VIOLATION = '23505'; // Postgres error code
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Atomic — backed by a DB sequence, so two concurrent calls can never return
 * the same number (unlike the old COUNT(*)+1 approach).
 */
async function generateRegNumber(pool) {
  const year = new Date().getFullYear();
  const { rows } = await pool.query("SELECT nextval('reg_number_seq') AS n");
  const seq = String(rows[0].n).padStart(5, '0');
  return `WB-${year}-${seq}`;
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
    const isMinor = isMinorAge(age);

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
    if (email?.trim() && !isValidEmail(email.trim()))
      return res.status(400).json({ error: 'Please enter a valid email address.' });

    // Each checked experience needs a date (description is optional)
    if (hasSalvation && !salvationDate)
      return res.status(400).json({ error: 'Salvation experience needs a date.' });
    if (hasSanctification && !sanctificationDate)
      return res.status(400).json({ error: 'Sanctification experience needs a date.' });
    if (hasHolyGhost && !holyGhostDate)
      return res.status(400).json({ error: 'Holy Ghost baptism needs a date.' });

    const dateOrderError = checkExperienceDateOrder({
      hasSalvation, salvationDate, hasSanctification, sanctificationDate, hasHolyGhost, holyGhostDate,
    });
    if (dateOrderError) return res.status(400).json({ error: dateOrderError });

    // Duplicate guard: same phone number already has an open (non-declined) registration.
    const normalizedPhone = normalizePhone(phoneNumber);
    const { rows: existingRows } = await pool.query(
      `SELECT reg_number, interview_date, interview_time, status
       FROM registrations
       WHERE regexp_replace(phone_number, '\\D', '', 'g') = $1
         AND status != 'declined'
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedPhone]
    );
    if (existingRows.length) {
      const ex = existingRows[0];
      return res.status(409).json({
        error: `This phone number is already registered as ${ex.reg_number}. ` +
          `Your interview is on ${ex.interview_date} at ${ex.interview_time}.`,
        existing: {
          regNumber: ex.reg_number,
          interviewDate: ex.interview_date,
          interviewTime: ex.interview_time,
          status: ex.status,
        },
      });
    }

    const insertParams = {
      fullName: fullName.trim(), gender, dateOfBirth: dateOfBirth || null,
      age: age != null ? String(age) : null, maritalStatus,
      residentialAddress: residentialAddress.trim(), phoneNumber: phoneNumber.trim(),
      email: email?.trim() || null,
      occupation: occupation?.trim() || null, nationality: nationality?.trim() || null,
      stateOfOrigin: stateOfOrigin?.trim() || null,
      branchChurch: branchChurch.trim(), branchChurchId: branchChurchId?.trim() || null,
      zone: zone?.trim() || null, zoneId: zoneId?.trim() || null,
      area: area?.trim() || null, areaId: areaId?.trim() || null,
      groupPastorName: groupPastorName?.trim() || null,
      salvationExperience: hasSalvation ? (salvationExperience?.trim() || null) : null,
      salvationDate: hasSalvation ? salvationDate : null,
      sanctificationExperience: hasSanctification ? (sanctificationExperience?.trim() || null) : null,
      sanctificationDate: hasSanctification ? sanctificationDate : null,
      holyGhostBaptism: hasHolyGhost ? (holyGhostBaptism?.trim() || null) : null,
      holyGhostDate: hasHolyGhost ? holyGhostDate : null,
      previouslyBaptized: previouslyBaptized ? 1 : 0,
      prevChurchName: prevChurchName?.trim() || null, prevModeOfBaptism: prevModeOfBaptism?.trim() || null,
      prevBaptismDate: prevBaptismDate || null,
      isMinor: isMinor ? 1 : 0,
      guardianName: guardianName?.trim() || null, guardianPhone: guardianPhone?.trim() || null,
      guardianConsent: guardianConsent ? 1 : 0, guardianSignature: guardianSignature?.trim() || null,
    };

    // The slot search and the INSERT race against other concurrent requests:
    // two people could both be handed the same free slot a moment apart. The
    // `uq_reg_slot` unique index makes that impossible to persist — on a
    // conflict we just re-pick the (now-updated) next free slot and retry.
    const MAX_ATTEMPTS = 5;
    let lastErr;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
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
          insertParams.fullName, insertParams.gender, insertParams.dateOfBirth, insertParams.age, insertParams.maritalStatus,
          insertParams.residentialAddress, insertParams.phoneNumber, insertParams.email,
          insertParams.occupation, insertParams.nationality, insertParams.stateOfOrigin,
          insertParams.branchChurch, insertParams.branchChurchId,
          insertParams.zone, insertParams.zoneId,
          insertParams.area, insertParams.areaId,
          insertParams.groupPastorName,
          insertParams.salvationExperience, insertParams.salvationDate,
          insertParams.sanctificationExperience, insertParams.sanctificationDate,
          insertParams.holyGhostBaptism, insertParams.holyGhostDate,
          insertParams.previouslyBaptized,
          insertParams.prevChurchName, insertParams.prevModeOfBaptism, insertParams.prevBaptismDate,
          insertParams.isMinor,
          insertParams.guardianName, insertParams.guardianPhone,
          insertParams.guardianConsent, insertParams.guardianSignature,
          interviewDate, interviewTime,
        ]);

        notify('registration.created', {
          registrationId: rows[0].id, regNumber, phoneNumber: insertParams.phoneNumber,
          interviewDate, interviewTime,
        }).catch(() => {});

        return res.status(201).json({ regNumber, interviewDate, interviewTime, id: rows[0].id });
      } catch (err) {
        // Slot was taken by a concurrent request between our check and our insert — retry.
        if (err.code === UNIQUE_VIOLATION && err.constraint === 'uq_reg_slot') {
          lastErr = err;
          continue;
        }
        throw err;
      }
    }
    throw lastErr || new Error('Could not book an interview slot after several attempts.');
  } catch (err) { next(err); }
});

// GET /api/registrations  (protected)
// dateFrom/dateTo (YYYY-MM-DD, inclusive) filter by interview_date and switch
// the sort to interview_date/time ascending — used by the interviewer
// "Schedule" day-view instead of the default recent-first list.
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50, dateFrom, dateTo } = req.query;
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
    if (dateFrom && DATE_RE.test(dateFrom)) {
      where += ` AND r.interview_date >= $${i++}`;
      params.push(dateFrom);
    }
    if (dateTo && DATE_RE.test(dateTo)) {
      where += ` AND r.interview_date <= $${i++}`;
      params.push(dateTo);
    }

    const isScheduleView = Boolean(dateFrom || dateTo);
    const orderBy = isScheduleView
      ? 'r.interview_date ASC, r.interview_time ASC'
      : 'r.created_at DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [{ rows }, countRes] = await Promise.all([
      pool.query(`
        SELECT r.id, r.reg_number, r.full_name, r.phone_number, r.branch_church,
               r.interview_date, r.interview_time, r.status, r.created_at,
               iv.name AS interviewer_name
        FROM registrations r
        LEFT JOIN interviewers iv ON iv.id = r.interviewer_id
        ${where}
        ORDER BY ${orderBy}
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

// GET /api/registrations/track/:regNumber  (public — status lookup by tracking number)
// Only returns fields safe to show to an unauthenticated candidate: no
// address, phone, spiritual answers, guardian info, or interviewer identity.
router.get('/track/:regNumber', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT reg_number, full_name, status, interview_date, interview_time
       FROM registrations WHERE reg_number = $1`,
      [req.params.regNumber.trim().toUpperCase()]
    );

    if (!rows.length)
      return res.status(404).json({ error: 'No registration found with that tracking number.' });

    const r = rows[0];
    res.json({
      regNumber: r.reg_number,
      fullName: r.full_name,
      status: r.status,
      interviewDate: r.interview_date,
      interviewTime: r.interview_time,
    });
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

    const fileName = `baptism-registrations-${toLocalDateStr(new Date())}.xlsx`;
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
