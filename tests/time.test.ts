import { describe, it, expect } from 'vitest';
import { phxDate, phxHour, daysBetween, addDays, dayIndex, dayForDate, dateForDay, likelyHotOutside, isYmd } from '@/lib/time';

describe('Phoenix date math', () => {
  it('converts instants to Phoenix calendar dates (UTC-7, no DST)', () => {
    // 2026-03-15 06:30 UTC = 2026-03-14 23:30 Phoenix
    expect(phxDate(Date.UTC(2026, 2, 15, 6, 30))).toBe('2026-03-14');
    expect(phxDate(Date.UTC(2026, 2, 15, 7, 0))).toBe('2026-03-15');
    // In July (when US DST is active elsewhere) Phoenix is still UTC-7
    expect(phxDate(Date.UTC(2026, 6, 15, 6, 59))).toBe('2026-07-14');
    expect(phxDate(Date.UTC(2026, 6, 15, 7, 0))).toBe('2026-07-15');
    expect(phxHour(Date.UTC(2026, 6, 15, 7, 0))).toBe(0);
    expect(phxHour(Date.UTC(2026, 6, 15, 20, 0))).toBe(13);
  });

  it('day index across midnight Phoenix', () => {
    const start = '2026-09-21';
    expect(dayIndex(start, '2026-09-21')).toBe(1);
    expect(dayIndex(start, '2026-09-27')).toBe(7);
    expect(dayIndex(start, '2026-09-28')).toBe(8);
    expect(dayIndex(start, '2026-10-04')).toBe(14);
    expect(dayIndex(start, '2026-11-01')).toBe(42);
    expect(dayIndex(start, '2026-11-02')).toBe(43);
    expect(dayIndex(start, '2026-09-20')).toBe(0);
    // instants around midnight
    const before = Date.UTC(2026, 8, 22, 6, 59); // 23:59 Phoenix on 21st
    const after = Date.UTC(2026, 8, 22, 7, 0); // 00:00 Phoenix on 22nd
    expect(dayIndex(start, phxDate(before))).toBe(1);
    expect(dayIndex(start, phxDate(after))).toBe(2);
  });

  it('shift pushes the remaining days', () => {
    const start = '2026-09-21';
    expect(dayIndex(start, '2026-09-25', 1)).toBe(4);
    expect(dayForDate(start, '2026-10-05', 1)).toBe(14);
    expect(dayForDate(start, '2026-11-02', 1)).toBe(42);
    expect(dayForDate(start, '2026-11-03', 1)).toBeNull();
    expect(dayForDate(start, '2026-10-06', 1, 14)).toBeNull();
    expect(dateForDay(start, 42, 1)).toBe('2026-11-02');
  });

  it('daysBetween / addDays cross month and year boundaries', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1);
  });

  it('flags likely-hot hours in Phoenix summer', () => {
    expect(likelyHotOutside(Date.UTC(2026, 6, 15, 20, 0))).toBe(true); // July 13:00
    expect(likelyHotOutside(Date.UTC(2026, 6, 15, 12, 0))).toBe(false); // July 05:00
    expect(likelyHotOutside(Date.UTC(2026, 0, 15, 20, 0))).toBe(false); // January
    expect(likelyHotOutside(Date.UTC(2026, 9, 15, 14, 0))).toBe(true); // Oct 07:00
    expect(likelyHotOutside(Date.UTC(2026, 9, 16, 2, 0))).toBe(false); // Oct 19:00
  });

  it('validates ymd strings', () => {
    expect(isYmd('2026-09-16')).toBe(true);
    expect(isYmd('9/16/2026')).toBe(false);
    expect(isYmd(null)).toBe(false);
  });
});
