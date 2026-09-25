import { describe, it, expect } from 'vitest';
import {
  decideCelebration, milestoneOn, HALFWAY_DAY, spanFor, dayStats, spanStats, logMinutes, minutesBetween,
  pickHeadline, fillHeadline, headlinePool, buildCelebration, milestoneLabel,
  DAY_HEADLINES, WEEK_HEADLINES, HALFWAY_HEADLINES, BLOCK_HEADLINES,
} from '@/lib/celebration';
import { daySessions } from '@/lib/progress';
import { BLOCK_DAYS, getDay } from '@/data/program';
import type { SessionLog } from '@/lib/db';

function log(dayN: number, sessionId: string, slot: SessionLog['slot'], minutes = 30, completed = true): SessionLog {
  const d = getDay(dayN);
  const start = Date.UTC(2026, 8, 20 + dayN, 14, 0);
  return { blockId: 1, dayN, week: d.week, day: d.day, slot, sessionId, startedAt: new Date(start).toISOString(), endedAt: new Date(start + minutes * 60_000).toISOString(), completed, data: {} };
}

/** Completed logs for every required session on day n, `minutes` each. */
function completeAll(n: number, minutes = 30): SessionLog[] {
  return daySessions(n).filter((s) => !s.optional).map((s) => log(n, s.id, s.slot, minutes));
}

const WEEK_ENDS = [7, 14, 21, 28, 35, 42].filter((d) => d <= BLOCK_DAYS);

describe('milestone map', () => {
  it('the block is 42 days and halfway is Day 21', () => {
    expect(BLOCK_DAYS).toBe(42);
    expect(HALFWAY_DAY).toBe(21);
  });

  it('every day maps to exactly one outcome: week ends, halfway, block, or nothing', () => {
    for (let n = 1; n <= BLOCK_DAYS; n++) {
      const m = milestoneOn(n);
      if (n === BLOCK_DAYS) expect(m, `day ${n}`).toBe('block');
      else if (n === HALFWAY_DAY) expect(m, `day ${n}`).toBe('halfway');
      else if (n % 7 === 0) expect(m, `day ${n}`).toBe('week');
      else expect(m, `day ${n}`).toBeNull();
    }
  });

  it('overlaps resolve upward: Day 21 is halfway not a week end, Day 42 is the block not a week end', () => {
    expect(milestoneOn(21)).toBe('halfway');
    expect(milestoneOn(42)).toBe('block');
    expect([7, 14, 28, 35].map(milestoneOn)).toEqual(['week', 'week', 'week', 'week']);
  });
});

describe('decideCelebration', () => {
  const fresh = (day: number, cause: 'log' | 'completeAll' | 'jump' = 'log') => decideCelebration({ day, cause, wasComplete: false, isComplete: true });

  it('fires the day tier on every ordinary day and the right milestone on every milestone day, by log and by Complete All', () => {
    for (let n = 1; n <= BLOCK_DAYS; n++) {
      for (const cause of ['log', 'completeAll'] as const) {
        const d = fresh(n, cause);
        expect(d, `day ${n} via ${cause}`).not.toBeNull();
        expect(d!.day).toBe(n);
        const m = milestoneOn(n);
        if (m) expect(d).toEqual({ tier: 'milestone', kind: m, day: n });
        else expect(d).toEqual({ tier: 'day', day: n });
      }
    }
  });

  it('a milestone replaces the day tier; never both', () => {
    for (const n of WEEK_ENDS) expect(fresh(n)!.tier).toBe('milestone');
    expect(fresh(21)).toEqual({ tier: 'milestone', kind: 'halfway', day: 21 });
    expect(fresh(42)).toEqual({ tier: 'milestone', kind: 'block', day: 42 });
  });

  it('Set current day (a jump) never celebrates, even onto a milestone day', () => {
    for (let n = 1; n <= BLOCK_DAYS; n++) {
      expect(decideCelebration({ day: n, cause: 'jump', wasComplete: false, isComplete: true })).toBeNull();
      expect(decideCelebration({ day: n, cause: 'jump', wasComplete: true, isComplete: true })).toBeNull();
    }
  });

  it('only a real transition to complete fires: not an unfinished day, not a day that was already done', () => {
    expect(decideCelebration({ day: 3, cause: 'log', wasComplete: false, isComplete: false })).toBeNull();
    expect(decideCelebration({ day: 3, cause: 'log', wasComplete: true, isComplete: true })).toBeNull();
    expect(decideCelebration({ day: 7, cause: 'completeAll', wasComplete: true, isComplete: true })).toBeNull();
    expect(decideCelebration({ day: 42, cause: 'completeAll', wasComplete: true, isComplete: true })).toBeNull();
  });

  it('days outside the block never fire', () => {
    expect(fresh(0)).toBeNull();
    expect(fresh(BLOCK_DAYS + 1)).toBeNull();
    expect(fresh(3.5)).toBeNull();
  });
});

describe('stats', () => {
  it('log minutes come from start to end, ignore garbage and cap absurd spans', () => {
    expect(logMinutes(log(1, 'A', 'main', 45))).toBe(45);
    expect(logMinutes(log(1, 'A', 'main', 0))).toBe(0);
    expect(logMinutes({ ...log(1, 'A', 'main'), endedAt: 'nope' })).toBe(0);
    expect(logMinutes(log(1, 'A', 'main', 10_000))).toBe(240);
    expect(minutesBetween([log(1, 'A', 'main', 20), log(2, 'A', 'main', 20), log(8, 'A', 'main', 20), log(3, 'A', 'main', 20, false)], 1, 7)).toBe(40);
  });

  it('day stats count required sessions on the day and minutes across its week', () => {
    const logs = [...completeAll(1, 10), ...completeAll(2, 10), ...completeAll(8, 10)];
    const req1 = daySessions(1).filter((s) => !s.optional).length;
    const req2 = daySessions(2).filter((s) => !s.optional).length;
    const s = dayStats(2, logs);
    expect(s.done).toBe(req2);
    expect(s.required).toBe(req2);
    expect(s.weekMinutes).toBe((req1 + req2) * 10);
    // an optional session logged on top does not push done past required
    const partial = dayStats(3, completeAll(3).slice(1));
    expect(partial.done).toBe(partial.required - 1);
  });

  it('spans: a week end recaps its seven days, halfway and block recap from Day 01', () => {
    expect(spanFor('week', 7)).toEqual({ from: 1, to: 7 });
    expect(spanFor('week', 35)).toEqual({ from: 29, to: 35 });
    expect(spanFor('halfway', 21)).toEqual({ from: 1, to: 21 });
    expect(spanFor('block', 42)).toEqual({ from: 1, to: 42 });
  });

  it('span stats: sessions done over required, total minutes, and consistency as complete days over span days', () => {
    // week 1 with days 1..6 done and day 7 done: 100%
    const week = Array.from({ length: 7 }, (_, i) => completeAll(i + 1, 15)).flat();
    const s = spanStats('week', 7, week);
    const required = Array.from({ length: 7 }, (_, i) => daySessions(i + 1).filter((x) => !x.optional).length).reduce((a, b) => a + b, 0);
    expect(s).toEqual({ from: 1, to: 7, done: required, required, minutes: required * 15, consistency: 100 });
    // days 3 and 5 skipped: 5/7 days complete
    const gappy = [1, 2, 4, 6, 7].map((n) => completeAll(n, 15)).flat();
    const g = spanStats('week', 7, gappy);
    expect(g.consistency).toBe(71);
    expect(g.done).toBeLessThan(g.required);
    // halfway with nothing logged
    expect(spanStats('halfway', 21, []).consistency).toBe(0);
  });
});

describe('copy', () => {
  it('every pool has at least eight headlines', () => {
    for (const pool of [DAY_HEADLINES, WEEK_HEADLINES, HALFWAY_HEADLINES, BLOCK_HEADLINES]) expect(pool.length).toBeGreaterThanOrEqual(8);
    expect(headlinePool({ tier: 'day', day: 3 })).toBe(DAY_HEADLINES);
    expect(headlinePool({ tier: 'milestone', kind: 'week', day: 7 })).toBe(WEEK_HEADLINES);
    expect(headlinePool({ tier: 'milestone', kind: 'halfway', day: 21 })).toBe(HALFWAY_HEADLINES);
    expect(headlinePool({ tier: 'milestone', kind: 'block', day: 42 })).toBe(BLOCK_HEADLINES);
  });

  it('pickHeadline never repeats the last index and reaches every other entry', () => {
    const pool = DAY_HEADLINES;
    for (let last = 0; last < pool.length; last++) {
      const seen = new Set<number>();
      for (let r = 0; r < 200; r++) {
        const i = pickHeadline(pool, last, () => r / 200);
        expect(i).not.toBe(last);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(pool.length);
        seen.add(i);
      }
      expect(seen.size).toBe(pool.length - 1);
    }
    expect(pickHeadline(pool, null, () => 0.999)).toBe(pool.length - 1);
    expect(pickHeadline(['only'], 0)).toBe(0);
  });

  it('templates fill the day (padded on the day tier) and the week', () => {
    expect(fillHeadline('Nice work — Day {day} done.', { tier: 'day', day: 4 })).toBe('Nice work — Day 04 done.');
    expect(fillHeadline('Week {week} in the books.', { tier: 'milestone', kind: 'week', day: 14 })).toBe('Week 2 in the books.');
    expect(fillHeadline('{day} days in.', { tier: 'milestone', kind: 'halfway', day: 21 })).toBe('21 days in.');
    expect(milestoneLabel('week', 28)).toBe('WEEK 4 COMPLETE');
    expect(milestoneLabel('halfway', 21)).toBe('HALFWAY');
    expect(milestoneLabel('block', 42)).toBe('BLOCK COMPLETE');
  });

  it('buildCelebration assembles copy and stats and does not repeat the previous headline for the same pool', () => {
    const logs = completeAll(14, 20);
    const a = buildCelebration({ tier: 'milestone', kind: 'week', day: 14 }, logs, 1000, () => 0.5);
    expect(a.tier).toBe('milestone');
    expect(a.at).toBe(1000);
    expect(a.headline.length).toBeGreaterThan(10);
    expect(a.stats).toMatchObject({ from: 8, to: 14 });
    // the same rng draw again maps around the last pick, so the headline changes
    const b = buildCelebration({ tier: 'milestone', kind: 'week', day: 14 }, logs, 1001, () => 0.5);
    expect(b.headline).not.toBe(a.headline);
    const d = buildCelebration({ tier: 'day', day: 14 }, logs, 1002);
    expect(d.tier).toBe('day');
    expect(d.headline).toContain('14');
    if (d.tier === 'day') expect(d.stats.done).toBe(d.stats.required);
  });
});
