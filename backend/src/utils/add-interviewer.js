/**
 * CLI script to add a new interviewer account.
 *
 * Usage:
 *   node src/utils/add-interviewer.js <name> <email> <password> [role]
 *
 * Examples:
 *   node src/utils/add-interviewer.js "Deacon Paul Eze" paul@church.org pass123
 *   node src/utils/add-interviewer.js "Admin Mary" mary@church.org secret123 admin
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt  = require('bcryptjs');
const { getDb } = require('../db');

const [,, name, email, password, role = 'interviewer'] = process.argv;

if (!name || !email || !password) {
  console.error('Usage: node src/utils/add-interviewer.js <name> <email> <password> [role]');
  process.exit(1);
}

const validRoles = ['interviewer', 'admin'];
if (!validRoles.includes(role)) {
  console.error(`Role must be one of: ${validRoles.join(', ')}`);
  process.exit(1);
}

try {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM interviewers WHERE email = ?').get(email);
  if (existing) {
    console.error(`An interviewer with email "${email}" already exists.`);
    process.exit(1);
  }

  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO interviewers (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email, password_hash, role);

  console.log(`✓ Created interviewer: ${name} <${email}> [${role}]`);
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
}
