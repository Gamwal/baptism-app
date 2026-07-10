import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  calcAge, isMinor, isValidPhone, isValidEmail, normalizePhone, checkExperienceDateOrder,
} from '../src/utils/validation.js';

describe('calcAge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 10)); // "today" = 2026-07-10
  });
  afterEach(() => vi.useRealTimers());

  it('returns null for empty/missing input', () => {
    expect(calcAge('')).toBeNull();
    expect(calcAge(null)).toBeNull();
    expect(calcAge(undefined)).toBeNull();
  });

  it('returns null for an unparseable date', () => {
    expect(calcAge('not-a-date')).toBeNull();
  });

  it('computes whole years correctly when birthday has passed this year', () => {
    expect(calcAge('2000-01-01')).toBe(26); // birthday was in January, already passed
  });

  it('computes whole years correctly when birthday has not yet occurred this year', () => {
    expect(calcAge('2000-12-25')).toBe(25); // birthday hasn't happened yet this year
  });

  it('computes correctly on the exact birthday', () => {
    expect(calcAge('2000-07-10')).toBe(26);
  });

  it('returns null for a future date of birth', () => {
    expect(calcAge('2099-01-01')).toBeNull();
  });
});

describe('isMinor', () => {
  it('is true for ages under 18', () => {
    expect(isMinor(17)).toBe(true);
    expect(isMinor(0)).toBe(true);
  });

  it('is false for 18 and above', () => {
    expect(isMinor(18)).toBe(false);
    expect(isMinor(40)).toBe(false);
  });

  it('is false when age is null (unknown)', () => {
    expect(isMinor(null)).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('accepts common phone formats', () => {
    expect(isValidPhone('08012345678')).toBe(true);
    expect(isValidPhone('+234 801 234 5678')).toBe(true);
    expect(isValidPhone('(080) 1234-5678')).toBe(true);
  });

  it('rejects too-short or too-long numbers', () => {
    expect(isValidPhone('12345')).toBe(false);        // < 7 digits
    expect(isValidPhone('1'.repeat(16))).toBe(false);  // > 15 digits
  });

  it('rejects letters or invalid characters', () => {
    expect(isValidPhone('080-ABC-5678')).toBe(false);
    expect(isValidPhone('call-me-maybe')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidPhone(undefined)).toBe(false);
    expect(isValidPhone(null)).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('accepts a well-formed email', () => {
    expect(isValidEmail('person@example.com')).toBe(true);
  });

  it('rejects malformed emails', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('@missing-local.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('strips all non-digit characters', () => {
    expect(normalizePhone('+234 (801) 234-5678')).toBe('2348012345678');
  });

  it('handles null/undefined gracefully', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });
});

describe('checkExperienceDateOrder', () => {
  it('accepts dates in correct chronological order', () => {
    const result = checkExperienceDateOrder({
      hasSalvation: true, salvationDate: '2015-01-01',
      hasSanctification: true, sanctificationDate: '2018-01-01',
      hasHolyGhost: true, holyGhostDate: '2020-01-01',
    });
    expect(result).toBeNull();
  });

  it('rejects sanctification before salvation', () => {
    const result = checkExperienceDateOrder({
      hasSalvation: true, salvationDate: '2018-01-01',
      hasSanctification: true, sanctificationDate: '2015-01-01',
      hasHolyGhost: false, holyGhostDate: null,
    });
    expect(result).toMatch(/chronological order|Salvation.*Sanctification/);
  });

  it('rejects Holy Ghost baptism before sanctification', () => {
    const result = checkExperienceDateOrder({
      hasSalvation: true, salvationDate: '2010-01-01',
      hasSanctification: true, sanctificationDate: '2020-01-01',
      hasHolyGhost: true, holyGhostDate: '2015-01-01',
    });
    expect(result).not.toBeNull();
  });

  it('ignores experiences that were not indicated', () => {
    // Only salvation checked; a stray sanctificationDate value (unchecked) must not be compared.
    const result = checkExperienceDateOrder({
      hasSalvation: true, salvationDate: '2020-01-01',
      hasSanctification: false, sanctificationDate: '2010-01-01',
      hasHolyGhost: false, holyGhostDate: null,
    });
    expect(result).toBeNull();
  });

  it('allows the same date for two consecutive experiences', () => {
    const result = checkExperienceDateOrder({
      hasSalvation: true, salvationDate: '2020-01-01',
      hasSanctification: true, sanctificationDate: '2020-01-01',
      hasHolyGhost: false, holyGhostDate: null,
    });
    expect(result).toBeNull();
  });

  it('returns null when nothing was indicated at all', () => {
    const result = checkExperienceDateOrder({
      hasSalvation: false, salvationDate: null,
      hasSanctification: false, sanctificationDate: null,
      hasHolyGhost: false, holyGhostDate: null,
    });
    expect(result).toBeNull();
  });
});
