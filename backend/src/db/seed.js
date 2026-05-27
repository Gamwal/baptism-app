/**
 * Seed default interviewer accounts.
 * Run with: npm run seed
 * Safe to run multiple times — skips accounts that already exist.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('./index');

const interviewers = [
  { name: 'Pastor James Okon',    email: 'james@church.org',  password: 'pass123', role: 'admin' },
  { name: 'Deaconess Ruth Bello', email: 'ruth@church.org',   password: 'pass123', role: 'interviewer' },
  { name: 'Elder Samuel Eze',     email: 'samuel@church.org', password: 'pass123', role: 'interviewer' },
];

async function seed() {
  for (const i of interviewers) {
    const { rows } = await pool.query('SELECT id FROM interviewers WHERE email = $1', [i.email]);
    if (rows.length) {
      console.log(`– Skipped (already exists): ${i.email}`);
      continue;
    }
    const hash = await bcrypt.hash(i.password, 10);
    await pool.query(
      'INSERT INTO interviewers (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [i.name, i.email, hash, i.role]
    );
    console.log(`✓ Created: ${i.name} <${i.email}> / password: ${i.password}`);
  }
}

seed()
  .then(() => { console.log('\nSeed complete.'); process.exit(0); })
  .catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
