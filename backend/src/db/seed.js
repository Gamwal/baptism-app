/**
 * Seed script — run once: `npm run seed`
 * Deletes the existing DB, recreates schema, creates default interviewer accounts.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt  = require('bcryptjs');
const fs      = require('fs');
const path    = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../baptism.db');

// Remove existing DB so schema is applied fresh
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('Removed existing database.');
}

const { getDb } = require('./index');
const db = getDb(); // this runs schema.sql on first open

const interviewers = [
  { name: 'Pastor James Okon',    email: 'james@church.org',   password: 'pass123', role: 'admin' },
  { name: 'Deaconess Ruth Bello', email: 'ruth@church.org',    password: 'pass123', role: 'interviewer' },
  { name: 'Elder Samuel Eze',     email: 'samuel@church.org',  password: 'pass123', role: 'interviewer' },
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO interviewers (name, email, password_hash, role)
  VALUES (@name, @email, @password_hash, @role)
`);

const insertMany = db.transaction(list => {
  for (const i of list) {
    const password_hash = bcrypt.hashSync(i.password, 10);
    insert.run({ name: i.name, email: i.email, password_hash, role: i.role });
    console.log(`✓ Created: ${i.name} <${i.email}> / password: ${i.password}`);
  }
});

insertMany(interviewers);
console.log('\nSeed complete. Log in at the /interviewer route with any of the accounts above.');
