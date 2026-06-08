/**
 * Finds the next available interview slot, honouring the admin-configured
 * `interview_settings` table (slot length, working hours, lead days, days of week).
 * Falls back to sensible defaults if the row is missing.
 */
const DEFAULTS = {
  slot_minutes: 15,
  start_hour:   9,
  end_hour:     17,
  lead_days:    3,
  days_of_week: '1,2,3,4,5,6',  // Mon–Sat
};

async function getSettings(pool) {
  try {
    const { rows } = await pool.query(
      'SELECT slot_minutes, start_hour, end_hour, lead_days, days_of_week FROM interview_settings WHERE id = 1'
    );
    return rows[0] || DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

async function getNextInterviewSlot(pool) {
  const s = await getSettings(pool);
  const SLOT_MINUTES = s.slot_minutes;
  const START_HOUR   = s.start_hour;
  const END_HOUR     = s.end_hour;
  const LEAD_DAYS    = s.lead_days;
  const allowedDays  = String(s.days_of_week).split(',').map(n => parseInt(n, 10));
  const MAX_SEARCH   = 180;

  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + LEAD_DAYS);

  for (let d = 0; d < MAX_SEARCH; d++) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + d);

    if (!allowedDays.includes(candidate.getDay())) continue;

    const dateStr = candidate.toISOString().split('T')[0];

    for (let h = START_HOUR; h < END_HOUR; h++) {
      for (let m = 0; m < 60; m += SLOT_MINUTES) {
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const { rows } = await pool.query(
          'SELECT id FROM registrations WHERE interview_date = $1 AND interview_time = $2',
          [dateStr, timeStr]
        );
        if (!rows.length) return { interviewDate: dateStr, interviewTime: timeStr };
      }
    }
  }

  throw new Error('No available interview slots in the configured window');
}

module.exports = { getNextInterviewSlot, getSettings };
