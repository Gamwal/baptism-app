/**
 * Central config — reads env vars once and fails loudly in production if
 * something security-critical is missing, instead of silently falling back
 * to a well-known default that anyone reading the source could use to forge
 * admin tokens.
 */
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

const DEV_ONLY_JWT_SECRET = 'dev-only-insecure-secret-do-not-use-in-production';

let jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  if (isProduction) {
    throw new Error(
      'JWT_SECRET is not set. Refusing to start in production without it — ' +
      'set a long random string in your environment variables.'
    );
  }
  console.warn('⚠️  JWT_SECRET is not set — using an insecure development-only default. ' +
    'Set JWT_SECRET in backend/.env before deploying.');
  jwtSecret = DEV_ONLY_JWT_SECRET;
}

module.exports = {
  isProduction,
  jwtSecret,
};
