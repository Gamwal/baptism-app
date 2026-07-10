/**
 * Notification hook — a single seam for "something happened, tell someone."
 *
 * Today this only logs to console + writes an audit row to
 * `notifications_log`. When a real channel (email/SMS) is wired up, only
 * this file changes — callers don't need to know or care how notify()
 * delivers.
 *
 * Events in use:
 *   registration.created     { registrationId, regNumber, phoneNumber, interviewDate, interviewTime }
 *   interview.rescheduled    { registrationId, regNumber, fromDate, fromTime, toDate, toTime, byInterviewerId }
 *   candidate.certified      { registrationId, regNumber, byInterviewerId }
 *   candidate.declined       { registrationId, regNumber, byInterviewerId }
 */
const { pool } = require('../db');
const logger = require('../logger');

async function notify(event, payload = {}) {
  logger.info({ event, ...payload }, `[notify] ${event}`);

  try {
    await pool.query(
      'INSERT INTO notifications_log (event, registration_id, payload) VALUES ($1, $2, $3)',
      [event, payload.registrationId || null, JSON.stringify(payload)]
    );
  } catch (err) {
    // A notification failure should never break the request that triggered it.
    logger.error({ err, event }, `[notify] failed to log "${event}"`);
  }
}

module.exports = { notify };
