/**
 * Interview slot scheduling, honouring the admin-configured `interview_settings`
 * row (slot length, working hours, lead days, days of week).
 *
 * Design: DB access (fetching settings + booked slots) is separated from the
 * actual slot-search logic. `computeNextSlot` / `getFreeSlotsForDate` are pure
 * functions — no I/O — so they're cheap to unit test and cheap to call: a
 * registration now costs one settings query + one booked-slots query, not one
 * query per candidate slot.
 */
const DEFAULTS = {
  slot_minutes: 15,
  start_hour:   9,
  end_hour:     17,
  lead_days:    3,
  days_of_week: '1,2,3,4,5,6',  // Mon–Sat
};

const MAX_SEARCH_DAYS = 180;

function pad(n) { return String(n).padStart(2, '0'); }

/**
 * Formats a Date's LOCAL calendar date as "YYYY-MM-DD".
 *
 * Deliberately not `date.toISOString().split('T')[0]` — that converts to
 * UTC first, which silently shifts the date by a day whenever the server
 * runs in a timezone ahead of UTC (e.g. Africa/Lagos, UTC+1): local midnight
 * Monday becomes 23:00 UTC *Sunday*, so the stored date string would read
 * "Sunday" even though every day-of-week check above used the correct local
 * Monday. Building the string from local getFullYear/getMonth/getDate
 * avoids that conversion entirely.
 */
function toLocalDateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** All "HH:MM" slot start times in one working day, per settings. */
function daySlotTimes(settings) {
  const times = [];
  for (let h = settings.start_hour; h < settings.end_hour; h++) {
    for (let m = 0; m < 60; m += settings.slot_minutes) {
      times.push(`${pad(h)}:${pad(m)}`);
    }
  }
  return times;
}

function slotKey(dateStr, timeStr) { return `${dateStr}|${timeStr}`; }

/**
 * Pure: finds the first free slot at/after `fromDate` + lead_days.
 * @param {object} settings   { slot_minutes, start_hour, end_hour, lead_days, days_of_week }
 * @param {Set<string>} bookedSet  keys as `${YYYY-MM-DD}|${HH:MM}`
 * @param {Date} fromDate     reference "today" (injectable for tests)
 */
function computeNextSlot(settings, bookedSet, fromDate = new Date()) {
  const allowedDays = String(settings.days_of_week).split(',').map(n => parseInt(n, 10));
  const times = daySlotTimes(settings);

  const base = new Date(fromDate);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + settings.lead_days);

  for (let d = 0; d < MAX_SEARCH_DAYS; d++) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + d);
    if (!allowedDays.includes(candidate.getDay())) continue;

    const dateStr = toLocalDateStr(candidate);
    for (const timeStr of times) {
      if (!bookedSet.has(slotKey(dateStr, timeStr))) {
        return { interviewDate: dateStr, interviewTime: timeStr };
      }
    }
  }

  throw new Error('No available interview slots in the configured window');
}

/**
 * Pure: all free "HH:MM" times on one specific date (used for rescheduling —
 * lead-time is intentionally not enforced here since a human interviewer is
 * making the call).
 */
function getFreeTimesForDate(settings, bookedSet, dateStr) {
  return daySlotTimes(settings).filter(t => !bookedSet.has(slotKey(dateStr, t)));
}

/** Whether `dateStr` falls on a day the church holds interviews, per settings. */
function isAllowedDay(settings, dateStr) {
  const allowedDays = String(settings.days_of_week).split(',').map(n => parseInt(n, 10));
  const d = new Date(`${dateStr}T00:00:00`);
  return !Number.isNaN(d.getTime()) && allowedDays.includes(d.getDay());
}

// ── DB-backed wrappers ────────────────────────────────────────────────────────

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

/** Booked slot keys from `fromDateStr` onward — one query, no per-slot lookups. */
async function getBookedSlotsSet(pool, fromDateStr, excludeRegistrationId = null) {
  const params = [fromDateStr];
  let sql = 'SELECT interview_date, interview_time FROM registrations WHERE interview_date >= $1';
  if (excludeRegistrationId) {
    params.push(excludeRegistrationId);
    sql += ' AND id != $2';
  }
  const { rows } = await pool.query(sql, params);
  return new Set(rows.map(r => slotKey(r.interview_date, r.interview_time)));
}

async function getNextInterviewSlot(pool) {
  const settings = await getSettings(pool);
  const now = new Date();
  const todayStr = toLocalDateStr(now);
  const booked = await getBookedSlotsSet(pool, todayStr);
  return computeNextSlot(settings, booked, now);
}

/**
 * Free times on a given date, for the reschedule UI. Excludes the
 * registration being moved (its own current slot should count as free for
 * itself) when `excludeRegistrationId` is given.
 */
async function getFreeSlotsForDate(pool, dateStr, excludeRegistrationId = null) {
  const settings = await getSettings(pool);
  const { rows } = await pool.query(
    'SELECT interview_time FROM registrations WHERE interview_date = $1' +
      (excludeRegistrationId ? ' AND id != $2' : ''),
    excludeRegistrationId ? [dateStr, excludeRegistrationId] : [dateStr]
  );
  const booked = new Set(rows.map(r => slotKey(dateStr, r.interview_time)));
  return {
    allowedDay: isAllowedDay(settings, dateStr),
    times: getFreeTimesForDate(settings, booked, dateStr),
  };
}

module.exports = {
  // pure (unit-testable)
  computeNextSlot,
  getFreeTimesForDate,
  isAllowedDay,
  daySlotTimes,
  toLocalDateStr,
  // DB-backed
  getSettings,
  getBookedSlotsSet,
  getNextInterviewSlot,
  getFreeSlotsForDate,
};
