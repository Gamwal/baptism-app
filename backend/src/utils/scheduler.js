/**
 * Finds the next available 30-minute interview slot.
 * Days: Monday–Saturday, 09:00–16:30.
 * Minimum lead time: 3 days from today.
 */
async function getNextInterviewSlot(pool) {
  const SLOT_MINUTES = 30;
  const START_HOUR   = 9;
  const END_HOUR     = 17; // last slot starts 16:30
  const LEAD_DAYS    = 3;
  const MAX_SEARCH   = 120;

  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + LEAD_DAYS);

  for (let d = 0; d < MAX_SEARCH; d++) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + d);

    if (candidate.getDay() === 0) continue; // skip Sunday

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

  throw new Error('No available interview slots in the next 120 days');
}

module.exports = { getNextInterviewSlot };
