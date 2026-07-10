/**
 * Pure, DB-free validation helpers for registration data — extracted so they
 * can be unit tested directly without spinning up the app or a database.
 */

const MINOR_AGE = 18;
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whole-year age from a "YYYY-MM-DD" string, or null if invalid/empty. */
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

function isMinor(age) {
  return age != null && age < MINOR_AGE;
}

/** Accepts digits, spaces, +, -, (, ) and requires 7–15 digits overall. */
function isValidPhone(phone) {
  if (typeof phone !== 'string' || !/^[\d\s+()-]+$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email);
}

/** Digits-only phone, for duplicate-registration comparison. */
function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * Spiritual experiences must be chronological: Salvation → Sanctification →
 * Holy Ghost Baptism. Only experiences that were actually indicated (has*
 * true, with a date) are compared — skipping one is fine.
 * Returns an error message string, or null if the order is valid.
 */
function checkExperienceDateOrder({
  hasSalvation, salvationDate,
  hasSanctification, sanctificationDate,
  hasHolyGhost, holyGhostDate,
}) {
  const orderedDates = [
    hasSalvation      && salvationDate      ? salvationDate      : null,
    hasSanctification && sanctificationDate ? sanctificationDate : null,
    hasHolyGhost      && holyGhostDate      ? holyGhostDate      : null,
  ].filter(Boolean);

  for (let k = 1; k < orderedDates.length; k++) {
    if (orderedDates[k] < orderedDates[k - 1]) {
      return 'Experience dates must follow the order: Salvation → Sanctification → Holy Ghost Baptism.';
    }
  }
  return null;
}

module.exports = {
  MINOR_AGE,
  calcAge,
  isMinor,
  isValidPhone,
  isValidEmail,
  normalizePhone,
  checkExperienceDateOrder,
};
