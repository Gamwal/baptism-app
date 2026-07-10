/**
 * Shared date/time formatters for "YYYY-MM-DD" / "HH:MM" strings as stored
 * by the backend (interview_date, interview_time, date_of_birth, etc).
 */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/** "2026-07-12" -> "12 Jul 2026" */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

/** "2026-07-12" -> "12 July 2026" (full month name, for formal contexts like the PDF slip) */
export function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d} ${MONTHS_LONG[parseInt(m, 10) - 1]} ${y}`;
}

/** "2026-07-12" -> "Sun, 12 Jul 2026" */
export function formatDateWithDay(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return formatDate(dateStr);
  return `${DAY_NAMES[d.getDay()]}, ${formatDate(dateStr)}`;
}

/** "14:30" -> "2:30 PM" */
export function formatTime(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** ISO timestamp -> "12 Jul 2026" (no time) */
export function formatDateOnly(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** ISO timestamp -> "12 Jul 2026, 14:30" */
export function formatDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** 14 -> "2:00 PM" (for hour-only selects, e.g. settings) */
export function formatHour(h) {
  const am = h < 12;
  const hh = h % 12 || 12;
  return `${hh}:00 ${am ? 'AM' : 'PM'}`;
}

export function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Today's LOCAL calendar date as "YYYY-MM-DD" — for use as a `<input
 * type="date">` min/max. Deliberately not `new Date().toISOString()`, which
 * converts to UTC first and silently returns yesterday's or tomorrow's date
 * for users in timezones ahead of or behind UTC around local midnight.
 */
export function todayLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
