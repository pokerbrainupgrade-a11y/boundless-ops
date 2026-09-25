import { describe, it, expect } from 'vitest';
import { daySessions, remainingSessions, isDayComplete, firstIncompleteDay } from '@/lib/progress';
import { BLOCK_DAYS, getDay } from '@/data/program';
import type { SessionLog } from '@/lib/db';

function log(dayN: number, sessionId: string, slot: SessionLog['slot'], completed = true): SessionLog {
  const d = getDay(dayN);
  return { blockId: 1, dayN, week: d.week, day: d.day, slot, sessionId, startedAt: '2026-09-21T14:00:00Z', endedAt: '2026-09-21T14:30:00Z', completed, data: {} };
}

/** Completed logs for every required session on day n. */
function completeAll(n: number): SessionLog[] {
  return daySessions(n).filter((s) => !s.optional).map((s) => log(n, s.id, s.slot));
}

describe('completion-gated day progress', () => {
  it('flattens a day into AM, MAIN, PM sessions with their optional flag', () => {
    const d1 = getDay(1);
    const flat = daySessions(1);
    expect(flat.length).toBe(d1.am.length + d1.main.length + d1.pm.length);
    expect(flat.map((s) => s.slot)).toEqual([...d1.am.map(() => 'am'), ...d1.main.map(() => 'main'), ...d1.pm.map(() => 'pm')]);
    expect(flat.every((s) => typeof s.optional === 'boolean')).toBe(true);
  });

  it('every program day has at least one required session, so no day auto-completes', () => {
    for (let n = 1; n <= BLOCK_DAYS; n++) expect(remainingSessions(n, []).length, `day ${n}`).toBeGreaterThan(0);
  });

  it('a day completes only when every required session has a completed log', () => {
    const req = daySessions(1).filter((s) => !s.optional);
    const allButOne = req.slice(1).map((s) => log(1, s.id, s.slot));
    expect(isDayComplete(1, allButOne)).toBe(false);
    expect(remainingSessions(1, allButOne).map((s) => s.id)).toEqual([req[0]!.id]);
    // an incomplete (abandoned) log does not count
    expect(isDayComplete(1, [...allButOne, log(1, req[0]!.id, req[0]!.slot, false)])).toBe(false);
    expect(isDayComplete(1, [...allButOne, log(1, req[0]!.id, req[0]!.slot)])).toBe(true);
    // the same session logged in another slot or on another day does not count
    expect(isDayComplete(1, [...allButOne, log(2, req[0]!.id, req[0]!.slot)])).toBe(false);
  });

  it('optional sessions never hold the day', () => {
    const withOptional = [2, 4, 9].find((n) => daySessions(n).some((s) => s.optional));
    expect(withOptional).toBeDefined();
    expect(isDayComplete(withOptional!, completeAll(withOptional!))).toBe(true);
  });

  it('out-of-range days are never complete', () => {
    expect(isDayComplete(0, [])).toBe(false);
    expect(isDayComplete(BLOCK_DAYS + 1, [])).toBe(false);
  });

  it('migration picks the first incomplete day, even when later days were logged', () => {
    expect(firstIncompleteDay([])).toBe(1);
    expect(firstIncompleteDay([...completeAll(1), ...completeAll(2)])).toBe(3);
    // day 2 skipped while the calendar ran ahead to day 5
    expect(firstIncompleteDay([...completeAll(1), ...completeAll(3), ...completeAll(5)])).toBe(2);
    const everything = Array.from({ length: BLOCK_DAYS }, (_, i) => completeAll(i + 1)).flat();
    expect(firstIncompleteDay(everything)).toBe(BLOCK_DAYS + 1);
  });
});
