/** All day math runs on the America/Phoenix calendar (no DST). */
export const TZ = 'America/Phoenix';

const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const partsFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false, month: 'numeric', weekday: 'short' });

/** 'YYYY-MM-DD' for the instant, in Phoenix. */
export function phxDate(ms: number = Date.now()): string {
  return ymdFmt.format(new Date(ms));
}

export function phxHour(ms: number = Date.now()): number {
  const h = partsFmt.formatToParts(new Date(ms)).find((p) => p.type === 'hour')?.value ?? '0';
  return Number(h) % 24;
}

/** 'HH:MM' for the instant, in Phoenix. */
export function phxHM(ms: number = Date.now()): string {
  const h = phxHour(ms);
  const min = new Intl.DateTimeFormat('en-US', { timeZone: TZ, minute: '2-digit' }).format(new Date(ms));
  return `${String(h).padStart(2, '0')}:${min.padStart(2, '0')}`;
}

export function phxMonth(ms: number = Date.now()): number {
  return Number(partsFmt.formatToParts(new Date(ms)).find((p) => p.type === 'month')?.value ?? '1');
}

export function isYmd(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function ymdToUtc(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Whole calendar days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((ymdToUtc(b) - ymdToUtc(a)) / 86_400_000);
}

export function addDays(ymd: string, n: number): string {
  const t = ymdToUtc(ymd) + n * 86_400_000;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * 1-based program day for a block that started on `startDate` (Phoenix date).
 * `shift` is the number of days the remaining schedule has been pushed.
 * Returns 0 before the start, and > block length after the block ends.
 */
export function dayIndex(startDate: string, today: string, shift = 0): number {
  return daysBetween(startDate, today) + 1 - shift;
}

/** Program day for an arbitrary date, or null when outside the block. */
export function dayForDate(startDate: string, date: string, shift = 0, blockDays = 42): number | null {
  const n = dayIndex(startDate, date, shift);
  return n >= 1 && n <= blockDays ? n : null;
}

/** Calendar date on which program day n falls. */
export function dateForDay(startDate: string, n: number, shift = 0): string {
  return addDays(startDate, n - 1 + shift);
}

export function fmtDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtShortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
}

/** Is it likely above 85°F outdoors in Phoenix right now? (May–Oct, 7am–7pm) */
export function likelyHotOutside(ms: number = Date.now()): boolean {
  const m = phxMonth(ms);
  const h = phxHour(ms);
  return m >= 5 && m <= 10 && h >= 7 && h < 19;
}
