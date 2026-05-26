/**
 * Auto-assigns the next available 30-minute interview slot.
 * Days: Monday–Saturday, 09:00–16:30
 * Lead time: minimum 3 days from today.
 */
function getNextInterviewSlot(db) {
  const SLOT_MINUTES = 30;
  const START_HOUR   = 9;   // 09:00
  const END_HOUR     = 17;  // last slot starts at 16:30
  const LEAD_DAYS    = 3;
  const MAX_SEARCH   = 120; // days to look ahead

  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + LEAD_DAYS);

  for (let d = 0; d < MAX_SEARCH; d++) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + d);

    const dayOfWeek = candidate.getDay(); // 0=Sun, 6=Sat
    if (dayOfWeek === 0) continue;        // skip Sundays

    const dateStr = candidate.toISOString().split('T')[0]; // YYYY-MM-DD

    for (let h = START_HOUR; h < END_HOUR; h++) {
      for (let m = 0; m < 60; m += SLOT_MINUTES) {
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const taken = db
          .prepare('SELECT id FROM registrations WHERE interview_date = ? AND interview_time = ?')
          .get(dateStr, timeStr);
        if (!taken) return { interviewDate: dateStr, interviewTime: timeStr };
      }
    }
  }

  throw new Error('No available interview slots in the next 120 days');
}

module.exports = { getNextInterviewSlot };
