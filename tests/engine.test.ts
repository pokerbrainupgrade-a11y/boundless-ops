import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntervalEngine, rounds, prep, fmtClock, fmtClockDown, type Segment } from '@/lib/engine';

function tabata(): Segment[] {
  return [prep(10), ...rounds(8, { label: 'GO GO GO', durationMs: 20_000 }, { label: 'BREATHE', durationMs: 10_000 })];
}

describe('IntervalEngine', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('computes total duration and segment count for tabata', () => {
    const e = new IntervalEngine(tabata());
    expect(e.segments.length).toBe(17);
    expect(e.totalDurationMs).toBe(10_000 + 8 * 30_000);
  });

  it('refuses an empty segment list', () => {
    expect(() => new IntervalEngine([])).toThrow();
  });

  it('transitions segments on time and finishes without drift', () => {
    const starts: number[] = [];
    const ends: string[] = [];
    let done = false;
    const e = new IntervalEngine(tabata(), {
      onSegmentStart: (i) => starts.push(i),
      onSegmentEnd: (_i, _s, r) => ends.push(r),
      onDone: () => (done = true),
    });
    e.start();
    expect(e.getState().status).toBe('running');
    expect(starts).toEqual([0]);
    // jitter the ticks: uneven intervals must not accumulate drift
    const jitters = [97, 103, 110, 90, 100, 101, 99];
    let elapsed = 0;
    let k = 0;
    while (elapsed < 250_000 && !done) {
      const step = jitters[k++ % jitters.length]!;
      vi.advanceTimersByTime(step);
      elapsed += step;
    }
    expect(done).toBe(true);
    expect(starts).toEqual([...Array(17).keys()]);
    expect(ends.length).toBe(17);
    expect(ends.every((r) => r === 'elapsed')).toBe(true);
    expect(e.getState().status).toBe('done');
    expect(e.getState().totalElapsedMs).toBe(250_000);
  });

  it('pause and resume keep the remaining time', () => {
    const e = new IntervalEngine(tabata());
    e.start();
    vi.advanceTimersByTime(4_000);
    e.pause();
    expect(e.getState().status).toBe('paused');
    const remAtPause = e.getState().segmentRemainingMs;
    expect(remAtPause).toBe(6_000);
    vi.advanceTimersByTime(60_000);
    expect(e.getState().segmentRemainingMs).toBe(6_000);
    expect(e.getState().index).toBe(0);
    e.resume();
    expect(e.getState().segmentRemainingMs).toBe(6_000);
    vi.advanceTimersByTime(6_000);
    expect(e.getState().index).toBe(1);
    expect(e.getState().segment?.kind).toBe('work');
  });

  it('toggle cycles idle → running → paused → running', () => {
    const e = new IntervalEngine(tabata());
    e.toggle();
    expect(e.getState().status).toBe('running');
    e.toggle();
    expect(e.getState().status).toBe('paused');
    e.toggle();
    expect(e.getState().status).toBe('running');
  });

  it('recovers from background: rolls through all elapsed segments from the stored start', () => {
    const starts: number[] = [];
    const e = new IntervalEngine(tabata(), { onSegmentStart: (i) => starts.push(i) });
    e.start();
    vi.advanceTimersByTime(1_000);
    // Simulate the OS suspending timers: advance the clock without firing intervals.
    vi.setSystemTime(Date.now() + 65_000);
    e.sync();
    // 66 s in: prep 10 + round1 30 + round2 30 = 70. So we are in round 2 rest? 10+20=30 (r1 work), 40 (r1 rest), 60 (r2 work), 70 (r2 rest)
    // 66 s -> index 4 (round 2 rest), elapsed 6 s, remaining 4 s
    const s = e.getState();
    expect(s.index).toBe(4);
    expect(s.segment?.kind).toBe('rest');
    expect(s.segmentRemainingMs).toBe(4_000);
    expect(starts).toEqual([0, 1, 2, 3, 4]);
  });

  it('skip advances immediately and reports skipped', () => {
    const ends: string[] = [];
    const e = new IntervalEngine(tabata(), { onSegmentEnd: (_i, _s, r) => ends.push(r) });
    e.start();
    e.skip();
    expect(e.getState().index).toBe(1);
    expect(ends).toEqual(['skipped']);
    e.pause();
    e.skip(); // skip while paused works too
    expect(e.getState().index).toBe(2);
    expect(e.getState().status).toBe('paused');
  });

  it('end() finishes early', () => {
    let done = 0;
    const e = new IntervalEngine(tabata(), { onDone: () => done++ });
    e.start();
    vi.advanceTimersByTime(500);
    e.end();
    expect(e.getState().status).toBe('done');
    expect(done).toBe(1);
    e.end();
    expect(done).toBe(1);
    expect(e.getState().segment).toBeNull();
  });

  it('fires 3-2-1 countdown beeps and a zero beep per timed segment', () => {
    const beeps: number[] = [];
    const zeros: number[] = [];
    const e = new IntervalEngine([prep(5), { label: 'x', kind: 'work', durationMs: 4_000 }], {
      onCountdown: (n) => beeps.push(n),
      onSegmentZero: (i) => zeros.push(i),
    });
    e.start();
    vi.advanceTimersByTime(9_100);
    expect(beeps).toEqual([3, 2, 1, 3, 2, 1]);
    expect(zeros).toEqual([0, 1]);
  });

  it('skips missed countdown beeps after a background gap', () => {
    const beeps: number[] = [];
    const e = new IntervalEngine([prep(10), { label: 'x', kind: 'work', durationMs: 10_000 }], { onCountdown: (n) => beeps.push(n) });
    e.start();
    vi.advanceTimersByTime(1_000);
    vi.setSystemTime(Date.now() + 8_500); // now at 9.5 s: remaining 0.5 s => n=1
    e.sync();
    expect(beeps).toEqual([1]);
  });

  it('open segments count up until skipped', () => {
    const e = new IntervalEngine([{ label: 'lift', kind: 'work', durationMs: 0, open: true }, { label: 'rest', kind: 'rest', durationMs: 90_000 }]);
    e.start();
    vi.advanceTimersByTime(123_456);
    const s = e.getState();
    expect(s.index).toBe(0);
    expect(s.segmentRemainingMs).toBe(Infinity);
    expect(s.secondsLeft).toBe(123);
    expect(s.segmentElapsedMs).toBe(123_456);
    e.skip();
    expect(e.getState().index).toBe(1);
    expect(e.getState().totalElapsedMs).toBe(123_456);
  });

  it('snapshot/restore continues from the same point', () => {
    const e = new IntervalEngine(tabata());
    e.start();
    vi.advanceTimersByTime(35_000);
    const snap = e.snapshot();
    e.dispose();
    vi.setSystemTime(Date.now() + 10_000);
    const r = IntervalEngine.restore(snap);
    const s = r.getState();
    // 45 s in: index 2 (round 1 rest ends at 40) -> round 2 work, elapsed 5 s
    expect(s.index).toBe(3);
    expect(s.segmentElapsedMs).toBe(5_000);
    expect(s.status).toBe('running');
    expect(s.totalElapsedMs).toBe(45_000);
    r.dispose();
    // restore a paused snapshot stays paused
    e.start; // no-op
    const p = new IntervalEngine(tabata());
    p.start();
    vi.advanceTimersByTime(2_000);
    p.pause();
    const ps = IntervalEngine.restore(p.snapshot());
    expect(ps.getState().status).toBe('paused');
    expect(ps.getState().segmentRemainingMs).toBe(8_000);
    // idle/done snapshots restore as idle
    const idle = IntervalEngine.restore(new IntervalEngine(tabata()).snapshot());
    expect(idle.getState().status).toBe('idle');
  });

  it('idle state reports zeros and ignores pause/resume/skip', () => {
    const e = new IntervalEngine(tabata());
    const s = e.getState();
    expect(s.status).toBe('idle');
    expect(s.segmentElapsedMs).toBe(0);
    expect(s.totalElapsedMs).toBe(0);
    e.pause();
    e.resume();
    e.skip();
    expect(e.getState().status).toBe('idle');
    e.start();
    e.start(); // second start ignored
    expect(e.getState().index).toBe(0);
  });

  it('onTick reports state and onStatus reports transitions', () => {
    const statuses: string[] = [];
    let ticks = 0;
    const e = new IntervalEngine(tabata(), { onStatus: (s) => statuses.push(s), onTick: () => ticks++ });
    e.start();
    vi.advanceTimersByTime(1_000);
    e.pause();
    e.resume();
    e.end();
    expect(statuses).toEqual(['running', 'paused', 'running', 'done']);
    expect(ticks).toBeGreaterThan(5);
  });

  it('rounds helper supports skipLastRest and meta', () => {
    const segs = rounds(3, { label: 'w', durationMs: 1000 }, { label: 'r', durationMs: 500 }, { skipLastRest: true });
    expect(segs.length).toBe(5);
    expect(segs[0]!.meta).toEqual({ round: 1, of: 3 });
    expect(segs[4]!.kind).toBe('work');
    expect(rounds(2, { label: 'w', durationMs: 1000 }, null).length).toBe(2);
  });

  it('formats clocks', () => {
    expect(fmtClock(0)).toBe('0:00');
    expect(fmtClock(61_000)).toBe('1:01');
    expect(fmtClock(59_400)).toBe('1:00');
    expect(fmtClockDown(59_400)).toBe('0:59');
    expect(fmtClock(Infinity)).toBe('--:--');
    expect(fmtClockDown(Infinity)).toBe('--:--');
  });
});
