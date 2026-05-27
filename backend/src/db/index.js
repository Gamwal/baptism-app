const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set.\n' +
    'Create a free Neon database at https://neon.tech, copy the connection string,\n' +
    'and add it to your .env file as DATABASE_URL=postgres://...'
  );
}

// For Neon (and most cloud PG providers), SSL is required.
// For a local PostgreSQL instance, SSL is not needed.
const ssl = process.env.DATABASE_URL.includes('localhost') ||
            process.env.DATABASE_URL.includes('127.0.0.1')
  ? false
  : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  max: 5, // keep low for serverless — each invocation gets its own pool
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

module.exports = { pool };
