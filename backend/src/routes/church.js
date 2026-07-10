/**
 * Proxy to the AFM Weca church directory API.
 * We normalise the upstream payload to `{ id, name, areaId?, zoneId? }` so
 * the frontend can populate cascading dropdowns without dealing with
 * pagination metadata or nested objects.
 *
 * Results are cached in-memory for CACHE_TTL_MS. If the upstream API is slow
 * or down, a stale cached copy is served rather than breaking registration
 * Step 2 entirely.
 */
const express = require('express');
const logger  = require('../logger');
const router  = express.Router();

const BASE = 'https://api.afmweca.org/afmchurches/api/v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const cache = new Map(); // url -> { data, fetchedAt }

async function fetchList(endpoint, params = {}) {
  const url = new URL(`${BASE}/${endpoint}`);
  url.searchParams.set('raw', 'true');
  url.searchParams.set('sort', 'asc');
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const key = url.toString();
  const cached = cache.get(key);
  const isFresh = cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS;

  if (isFresh) return cached.data;

  try {
    const res = await fetch(key);
    if (!res.ok) throw new Error(`Upstream ${endpoint} returned ${res.status}`);
    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    cache.set(key, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    // Upstream is down/slow — fall back to a stale cached copy if we have one
    // rather than breaking registration entirely.
    if (cached) {
      logger.warn({ err, endpoint }, `[church] upstream fetch failed for ${endpoint}, serving stale cache`);
      return cached.data;
    }
    throw err;
  }
}

// GET /api/church/areas
router.get('/areas', async (_req, res, next) => {
  try {
    const items = await fetchList('area');
    res.json({ areas: items.map(a => ({ id: a.id, name: a.name })) });
  } catch (err) { next(err); }
});

// GET /api/church/zones?areaId=...
router.get('/zones', async (req, res, next) => {
  try {
    const items = await fetchList('zone', { areaId: req.query.areaId });
    res.json({
      zones: items.map(z => ({
        id:     z.id,
        name:   z.name,
        areaId: z.area?.id || null,
      })),
    });
  } catch (err) { next(err); }
});

// GET /api/church/branches?zoneId=...&areaId=...
router.get('/branches', async (req, res, next) => {
  try {
    const items = await fetchList('branch', {
      areaId: req.query.areaId,
      zoneId: req.query.zoneId,
    });
    res.json({
      branches: items.map(b => ({
        id:     b.id,
        name:   b.name,
        zoneId: b.zone?.id || null,
        areaId: b.area?.id || null,
      })),
    });
  } catch (err) { next(err); }
});

module.exports = router;
