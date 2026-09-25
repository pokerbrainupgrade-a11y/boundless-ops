/**
 * Celebration feedback: which tier fires when a day is finished, and the copy and stats it shows.
 * Pure. Nothing here touches the DOM, audio, or storage; the store decides *when* to call it
 * and a component decides *how* to show it. Nothing is ever persisted: a celebration plays once and is gone.
 */
import { BLOCK_DAYS, getDay } from '@/data/program';
import type { SessionLog } from './db';
import { daySessions, isDayComplete, isSessionDone } from './progress';

export type CelebrationTier = 'day' | 'milestone';
export type MilestoneKind = 'week' | 'halfway' | 'block';

/** How the day came to be finished. Only real completions celebrate; a jump never does. */
export type CompletionCause = 'log' | 'completeAll' | 'jump';

export interface CelebrationInput {
  /** Program day, 1..BLOCK_DAYS. */
  day: number;
  cause: CompletionCause;
  /** Was every required session already logged before this action? */
  wasComplete: boolean;
  /** Is every required session logged after it? */
  isComplete: boolean;
}

export type CelebrationDecision =
  | { tier: 'day'; day: number }
  | { tier: 'milestone'; kind: MilestoneKind; day: number };

export const HALFWAY_DAY = Math.round(BLOCK_DAYS / 2);

/** The single highest milestone on day n, or null when it is an ordinary day. */
export function milestoneOn(day: number): MilestoneKind | null {
  if (day === BLOCK_DAYS) return 'block';
  if (day === HALFWAY_DAY) return 'halfway';
  if (day >= 7 && day % 7 === 0) return 'week';
  return null;
}

/**
 * Which celebration a completion event earns. Null when nothing should play:
 * the day was already finished, is still unfinished, is out of range, or was reached by a jump.
 * When milestones overlap only the highest fires; a milestone always replaces the day tier.
 */
export function decideCelebration(i: CelebrationInput): CelebrationDecision | null {
  if (i.cause === 'jump') return null;
  if (!Number.isInteger(i.day) || i.day < 1 || i.day > BLOCK_DAYS) return null;
  if (i.wasComplete || !i.isComplete) return null;
  const kind = milestoneOn(i.day);
  return kind ? { tier: 'milestone', kind, day: i.day } : { tier: 'day', day: i.day };
}

/* ---------------- stats ---------------- */

export interface DayStats {
  /** Required sessions logged on the day / required sessions scheduled. */
  done: number;
  required: number;
  /** Minutes logged across the calendar week the day belongs to (program days 7w-6..7w). */
  weekMinutes: number;
}

export interface SpanStats {
  from: number;
  to: number;
  done: number;
  required: number;
  minutes: number;
  /** Percentage of days in the span with every required session logged, 0..100. */
  consistency: number;
}

/** First and last program day a milestone recaps. */
export function spanFor(kind: MilestoneKind, day: number): { from: number; to: number } {
  if (kind === 'week') return { from: day - 6, to: day };
  return { from: 1, to: day };
}

const MAX_SESSION_MIN = 4 * 60;

/** Whole minutes between a log's start and end, ignoring garbage and capping absurd spans. */
export function logMinutes(l: SessionLog): number {
  const a = Date.parse(l.startedAt);
  const b = Date.parse(l.endedAt);
  if (isNaN(a) || isNaN(b) || b <= a) return 0;
  return Math.min(MAX_SESSION_MIN, Math.round((b - a) / 60_000));
}

/** Minutes logged on completed sessions for program days from..to inclusive. */
export function minutesBetween(logs: SessionLog[], from: number, to: number): number {
  let sum = 0;
  for (const l of logs) if (l.completed && l.dayN >= from && l.dayN <= to) sum += logMinutes(l);
  return sum;
}

export function dayStats(day: number, logs: SessionLog[]): DayStats {
  const req = daySessions(day).filter((s) => !s.optional);
  const done = req.filter((s) => isSessionDone(logs, day, s.id, s.slot)).length;
  const week = getDay(day).week;
  return { done, required: req.length, weekMinutes: minutesBetween(logs, week * 7 - 6, week * 7) };
}

export function spanStats(kind: MilestoneKind, day: number, logs: SessionLog[]): SpanStats {
  const { from, to } = spanFor(kind, day);
  let done = 0;
  let required = 0;
  let completeDays = 0;
  for (let n = from; n <= to; n++) {
    const req = daySessions(n).filter((s) => !s.optional);
    required += req.length;
    done += req.filter((s) => isSessionDone(logs, n, s.id, s.slot)).length;
    if (isDayComplete(n, logs)) completeDays++;
  }
  const days = to - from + 1;
  return { from, to, done, required, minutes: minutesBetween(logs, from, to), consistency: days ? Math.round((100 * completeDays) / days) : 0 };
}

/* ---------------- copy ---------------- */

/** `{day}` is the padded day number, `{week}` the week number. */
export const DAY_HEADLINES: readonly string[] = [
  'Nice work — Day {day} done.',
  "That's Day {day} in the books.",
  'Day {day} complete. Stack it.',
  'Solid. Day {day} logged.',
  'Another one down. Day {day}.',
  'Day {day} handled. Recover well.',
  'Showed up, did the work. Day {day}.',
  'Day {day} cleared. Keep it honest.',
  'Mission complete for Day {day}.',
  'Day {day} secured. Same again tomorrow.',
];

export const WEEK_HEADLINES: readonly string[] = [
  'Week {week} in the books.',
  'Seven days, one week done. This is how blocks get built.',
  'Week {week} secured. Rest tonight, you earned it.',
  'Another week down. The base is getting deeper.',
  'Week {week} complete. Consistency is the whole game.',
  'A full week logged. Momentum is real now.',
  'Week {week} cleared. On to the next one.',
  'One more week of work banked.',
];

export const HALFWAY_HEADLINES: readonly string[] = [
  'Halfway. Twenty-one days of showing up.',
  'Three weeks down, three to go. The hard half is behind you.',
  'Halfway through the block. Look at that base.',
  'Day {day}. The turn is here. Finish stronger than you started.',
  'Halfway point secured. Same standard for the back half.',
  '{day} days in. The habit is built; now sharpen it.',
  'Midpoint reached. Recover, then attack week four.',
  "Half the block done. You're the kind of operator who finishes.",
];

export const BLOCK_HEADLINES: readonly string[] = [
  'Block complete. Forty-two days of work, logged.',
  "That's the whole block. Every session, every day.",
  'Six weeks. Done. Sit with that for a second.',
  'Operation block complete. You held the standard.',
  '{day} days. The block is finished. So is the excuse of not being ready.',
  'Block finished. Now go look at the numbers.',
  'Mission accomplished. Six weeks of consistency.',
  'End of block. Take the win, then take the rest.',
];

export function headlinePool(d: CelebrationDecision): readonly string[] {
  if (d.tier === 'day') return DAY_HEADLINES;
  return d.kind === 'block' ? BLOCK_HEADLINES : d.kind === 'halfway' ? HALFWAY_HEADLINES : WEEK_HEADLINES;
}

/**
 * Random index into `pool`, never `last` when the pool has more than one entry.
 * `rng` returns [0, 1) and is injectable for tests.
 */
export function pickHeadline(pool: readonly string[], last: number | null, rng: () => number = Math.random): number {
  if (pool.length <= 1) return 0;
  if (last === null || last < 0 || last >= pool.length) return Math.floor(rng() * pool.length) % pool.length;
  // Draw from the pool with the last entry removed, then map back around it.
  const i = Math.floor(rng() * (pool.length - 1)) % (pool.length - 1);
  return i >= last ? i + 1 : i;
}

export function fillHeadline(template: string, d: CelebrationDecision): string {
  const week = Math.ceil(d.day / 7);
  const day = d.tier === 'day' ? String(d.day).padStart(2, '0') : String(d.day);
  return template.replaceAll('{day}', day).replaceAll('{week}', String(week));
}

/** Stamp above a milestone headline. */
export function milestoneLabel(kind: MilestoneKind, day: number): string {
  if (kind === 'block') return 'BLOCK COMPLETE';
  if (kind === 'halfway') return 'HALFWAY';
  return `WEEK ${Math.ceil(day / 7)} COMPLETE`;
}

/* ---------------- assembled event ---------------- */

export type Celebration =
  | { tier: 'day'; day: number; headline: string; stats: DayStats; at: number }
  | { tier: 'milestone'; kind: MilestoneKind; day: number; headline: string; stats: SpanStats; at: number };

const lastPick: Partial<Record<'day' | MilestoneKind, number>> = {};

/** Build the event a decision produces: copy from the right pool (no immediate repeat) plus its stats. */
export function buildCelebration(d: CelebrationDecision, logs: SessionLog[], now = Date.now(), rng: () => number = Math.random): Celebration {
  const key = d.tier === 'day' ? 'day' : d.kind;
  const pool = headlinePool(d);
  const idx = pickHeadline(pool, lastPick[key] ?? null, rng);
  lastPick[key] = idx;
  const headline = fillHeadline(pool[idx]!, d);
  if (d.tier === 'day') return { tier: 'day', day: d.day, headline, stats: dayStats(d.day, logs), at: now };
  return { tier: 'milestone', kind: d.kind, day: d.day, headline, stats: spanStats(d.kind, d.day, logs), at: now };
}
