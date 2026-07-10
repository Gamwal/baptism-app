import { describe, it, expect } from 'vitest';
import {
  computeNextSlot, getFreeTimesForDate, isAllowedDay, daySlotTimes, toLocalDateStr,
} from '../src/utils/scheduler.js';

const MON_WED_FRI_9AM_TO_5PM = {
  slot_minutes: 30,
  start_hour: 9,
  end_hour: 17,
  lead_days: 0,
  days_of_week: '1,2,3,4,5,6', // Mon–Sat
};

describe('daySlotTimes', () => {
  it('generates 30-minute slots between start and end hour', () => {
    const times = daySlotTimes({ slot_minutes: 30, start_hour: 9, end_hour: 11 });
    expect(times).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });

  it('generates 15-minute slots', () => {
    const times = daySlotTimes({ slot_minutes: 15, start_hour: 9, end_hour: 10 });
    expect(times).toEqual(['09:00', '09:15', '09:30', '09:45']);
  });
});

describe('toLocalDateStr', () => {
  it('formats using local date components, not UTC', () => {
    // Constructed from local Y/M/D — must round-trip exactly regardless of
    // the machine's timezone. This is the exact bug class that caused
    // Sunday interviews to be scheduled under a UTC+1 server: a date built
    // from toISOString().split('T')[0] would silently shift back a day.
    const d = new Date(2026, 6, 13, 0, 0, 0); // July 13 2026, local midnight
    expect(toLocalDateStr(d)).toBe('2026-07-13');
  });

  it('zero-pads single-digit month and day', () => {
    const d = new Date(2026, 0, 5, 0, 0, 0); // Jan 5 2026
    expect(toLocalDateStr(d)).toBe('2026-01-05');
  });
});

describe('isAllowedDay', () => {
  const settings = { days_of_week: '1,2,3,4,5,6' }; // Mon–Sat, no Sunday

  it('rejects a Sunday date', () => {
    // 2026-07-12 is a Sunday
    expect(isAllowedDay(settings, '2026-07-12')).toBe(false);
  });

  it('accepts a Monday date', () => {
    // 2026-07-13 is a Monday
    expect(isAllowedDay(settings, '2026-07-13')).toBe(true);
  });

  it('returns false for an unparseable date string', () => {
    expect(isAllowedDay(settings, 'not-a-date')).toBe(false);
  });
});

describe('computeNextSlot', () => {
  it('returns the first slot on the earliest allowed day when nothing is booked', () => {
    // fromDate = Monday 2026-07-13, lead_days = 0 -> should return that same Monday
    const from = new Date(2026, 6, 13);
    const result = computeNextSlot(MON_WED_FRI_9AM_TO_5PM, new Set(), from);
    expect(result).toEqual({ interviewDate: '2026-07-13', interviewTime: '09:00' });
  });

  it('skips a fully booked day and moves to the next allowed day', () => {
    const settings = { ...MON_WED_FRI_9AM_TO_5PM, start_hour: 9, end_hour: 10, slot_minutes: 30 };
    // Only two slots exist on 2026-07-13 (09:00, 09:30) — book both.
    const booked = new Set(['2026-07-13|09:00', '2026-07-13|09:30']);
    const from = new Date(2026, 6, 13);
    const result = computeNextSlot(settings, booked, from);
    // Next allowed day (Tue 2026-07-14) should be offered instead
    expect(result).toEqual({ interviewDate: '2026-07-14', interviewTime: '09:00' });
  });

  it('never returns a disallowed day of week even when all allowed days are booked out to that point', () => {
    // Only Monday allowed. Book Monday 2026-07-13 fully — must skip Tue–Sun
    // and land on the *next* Monday, never a disallowed day in between.
    const settings = { slot_minutes: 60, start_hour: 9, end_hour: 10, lead_days: 0, days_of_week: '1' };
    const booked = new Set(['2026-07-13|09:00']);
    const from = new Date(2026, 6, 13);
    const result = computeNextSlot(settings, booked, from);
    expect(result.interviewDate).toBe('2026-07-20'); // next Monday
    const dow = new Date(`${result.interviewDate}T00:00:00`).getDay();
    expect(dow).toBe(1); // Monday
  });

  it('honours lead_days by not offering slots before the lead time', () => {
    const settings = { ...MON_WED_FRI_9AM_TO_5PM, lead_days: 3 };
    const from = new Date(2026, 6, 13); // Monday
    const result = computeNextSlot(settings, new Set(), from);
    // 3 days after Monday 07-13 is Thursday 07-16
    expect(result.interviewDate).toBe('2026-07-16');
  });

  it('throws when no slots are available in the search window', () => {
    // No day of week is allowed at all -> impossible to find a slot.
    const settings = { slot_minutes: 30, start_hour: 9, end_hour: 17, lead_days: 0, days_of_week: '' };
    expect(() => computeNextSlot(settings, new Set(), new Date(2026, 6, 13))).toThrow();
  });
});

describe('getFreeTimesForDate', () => {
  it('filters out booked times, leaving the rest', () => {
    const settings = { slot_minutes: 30, start_hour: 9, end_hour: 11 };
    const booked = new Set(['2026-07-13|09:30']);
    const times = getFreeTimesForDate(settings, booked, '2026-07-13');
    expect(times).toEqual(['09:00', '10:00', '10:30']);
  });

  it('returns all times when nothing is booked', () => {
    const settings = { slot_minutes: 60, start_hour: 9, end_hour: 12 };
    const times = getFreeTimesForDate(settings, new Set(), '2026-07-13');
    expect(times).toEqual(['09:00', '10:00', '11:00']);
  });
});
