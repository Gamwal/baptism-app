/**
 * One-time database setup: applies schema.pg.sql to your Neon / PostgreSQL database.
 * Run with: npm run db:setup
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs   = require('fs');
const path = require('path');
const { pool } = require('./index');

async function setup() {
  const schema = fs.readFileSync(path.join(__dirname, '../../schema.pg.sql'), 'utf8');

  // Split on semicolons, skip empty/whitespace-only statements
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  const client = await pool.connect();
  try {
    for (const stmt of statements) {
      await client.query(stmt);
    }
    console.log(`✓ Schema applied (${statements.length} statements)`);
  } finally {
    client.release();
  }
}

setup()
  .then(() => { console.log('Database setup complete.'); process.exit(0); })
  .catch(err => { console.error('Setup failed:', err.message); process.exit(1); });
