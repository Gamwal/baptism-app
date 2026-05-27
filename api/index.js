// Vercel serverless entry point.
// All /api/* requests are rewritten here by vercel.json.
// The Express app handles routing internally.
module.exports = require('../backend/src/server');
