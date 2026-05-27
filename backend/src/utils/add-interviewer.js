/**
 * CLI to add a new interviewer.
 * Usage: node src/utils/add-interviewer.js <name> <email> <password> [role]
 * Or:    npm run add-interviewer -- "Name" email@church.org password123 [admin]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const [,, name, email, password, role = 'interviewer'] = process.argv;

if (!name || !email || !password) {
  console.error('Usage: node src/utils/add-interviewer.js <name> <email> <password> [role]');
  process.exit(1);
}
if (!['interviewer', 'admin'].includes(role)) {
  console.error('Role must be "interviewer" or "admin"');
  process.exit(1);
}

async function run() {
  const { rows } = await pool.query('SELECT id FROM interviewers WHERE email = $1', [email]);
  if (rows.length) {
    console.error(`An interviewer with email "${email}" already exists.`);
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO interviewers (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
    [name, email, hash, role]
  );
  console.log(`✓ Created: ${name} <${email}> [${role}]`);
}

run()
  .then(() => process.exit(0))
  .catch(err => { console.error('Failed:', err.message); process.exit(1); });
