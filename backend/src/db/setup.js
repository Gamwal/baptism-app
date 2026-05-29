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

  // Run the whole file in one simple query. Postgres parses `--` comments and
  // multiple `;`-separated statements itself, so we don't have to split (and
  // splitting would break on semicolons that appear inside comments).
  const client = await pool.connect();
  try {
    await client.query(schema);
    console.log('✓ Schema applied');
  } finally {
    client.release();
  }
}

setup()
  .then(() => { console.log('Database setup complete.'); process.exit(0); })
  .catch(err => { console.error('Setup failed:', err.message); process.exit(1); });
