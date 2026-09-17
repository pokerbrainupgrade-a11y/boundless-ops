import { describe, it, expect } from 'vitest';
import { buildPreset, sevenMinuteSequence, tabataMoves, superSlowOptions, ENGINE_PRESETS, STATE_COPY, type PresetOptions } from '@/lib/presets';

const base = (extra: Partial<PresetOptions> = {}): PresetOptions => ({ leadInSec: 10, week: 1, ...extra });

describe('presets (segment count + total duration)', () => {
  it('tabata = 10 s prep + 8 × (20/10) = 4:10', () => {
    const b = buildPreset('tabata', base());
    expect(b.segments.length).toBe(17);
    expect(b.totalMs).toBe(250_000);
    expect(b.segments[0]!.label).toBe(STATE_COPY.prep);
    expect(b.segments[1]!.label).toBe('GO');
    expect(b.segments[2]!.label).toBe('RECOVER');
    expect(b.segments[2]!.logPrompt).toBe('cals');
  });
  it('tabata defaults to the requested movement and falls back to the first', () => {
    expect(buildPreset('tabata', base({ tabataMove: 'kbSwings' })).meta.unit).toBe('reps');
    expect(buildPreset('tabata', base({ tabataMove: 'nope' })).meta.move).toBe('bike');
    expect(tabataMoves().length).toBe(10);
  });
  it('5x4 = prep + 5 × (4:00/4:00) = 40:10', () => {
    const b = buildPreset('vo2', base());
    expect(b.segments.length).toBe(11);
    expect(b.totalMs).toBe(10_000 + 5 * 480_000);
  });
  it('sprints G1/G2/G3', () => {
    expect(buildPreset('sprints', base({ sprintVariant: 'G1' })).totalMs).toBe(10_000 + 4 * 270_000);
    expect(buildPreset('sprints', base({ sprintVariant: 'G1' })).segments.length).toBe(9);
    expect(buildPreset('sprints', base({ sprintVariant: 'G2' })).totalMs).toBe(10_000 + 5 * 24_000);
    expect(buildPreset('sprints', base({ sprintVariant: 'G2' })).segments.length).toBe(11);
    const g3 = buildPreset('sprints', base({ sprintVariant: 'G3' }));
    expect(g3.segments.length).toBe(1 + 3 * 10 + 2);
    expect(g3.totalMs).toBe(10_000 + 3 * 120_000 + 2 * 60_000);
  });
  it('7-minute: 12 × (30/10) per round, no transition after the last move', () => {
    const one = buildPreset('sevenMinute', base({ sevenRounds: 1 }));
    expect(one.segments.length).toBe(1 + 12 + 11);
    expect(one.totalMs).toBe(10_000 + 12 * 30_000 + 11 * 10_000);
    const three = buildPreset('sevenMinute', base({ sevenRounds: 3 }));
    expect(three.segments.length).toBe(1 + 36 + 35);
    expect(three.totalMs).toBe(10_000 + 36 * 30_000 + 35 * 10_000);
    expect(three.segments[1]!.meta?.next).toBe('wallSit');
  });
  it('7-minute W2 uses the explosive swaps', () => {
    expect(sevenMinuteSequence(1).map((m) => m.id)[0]).toBe('jumpingJacks');
    expect(sevenMinuteSequence(2).map((m) => m.id)[0]).toBe('burpees');
    expect(sevenMinuteSequence(2).filter((m) => m.swapped).length).toBe(7);
    expect(buildPreset('sevenMinute', base({ week: 2 })).meta.explosive).toBe(true);
  });
  it('super-slow: 4 open lifts with 3 rests, FAILURE ends the lift', () => {
    const b = buildPreset('superSlow', base({ restSec: 90 }));
    expect(b.segments.length).toBe(1 + 4 + 3);
    expect(b.totalMs).toBe(10_000 + 3 * 90_000);
    expect(b.segments[1]!.open).toBe(true);
    expect(b.segments[1]!.label).toBe('TO FAILURE');
    expect(superSlowOptions('lowerPull')).toContain('Deadlift');
    expect(buildPreset('superSlow', base({ restSec: 500 })).meta.restSec).toBe(120);
  });
  it('cold shower = prep + 10 × (10/20) = 5:10', () => {
    const b = buildPreset('coldShower', base());
    expect(b.segments.length).toBe(21);
    expect(b.totalMs).toBe(310_000);
    expect(b.segments[2]!.label).toBe('COLD');
  });
  it('immersion / sauna / contrast / stamina / countdown', () => {
    expect(buildPreset('coldImmersion', base({ minutes: 4 })).totalMs).toBe(10_000 + 240_000);
    expect(buildPreset('coldImmersion', base({ minutes: 9 })).totalMs).toBe(10_000 + 300_000);
    expect(buildPreset('sauna', base({ minutes: 30 })).totalMs).toBe(10_000 + 1_800_000);
    expect(buildPreset('sauna', base({ minutes: 90 })).meta.minutes).toBe(40);
    const c = buildPreset('contrast', base({ cycles: 3 }));
    expect(c.segments.length).toBe(7);
    expect(c.totalMs).toBe(10_000 + 3 * 900_000);
    expect(c.segments[c.segments.length - 1]!.label).toBe('COLD');
    expect(buildPreset('stamina', base({ minutes: 150 })).totalMs).toBe(10_000 + 150 * 60_000);
    expect(buildPreset('stamina', base({ minutes: 150 })).meta.halfwayMs).toBe(75 * 60_000);
    expect(buildPreset('stamina', base({ minutes: 150 })).meta.hydrateEveryMs).toBe(20 * 60_000);
    expect(buildPreset('countdown', base({ minutes: 15, leadInSec: 0 })).totalMs).toBe(900_000);
  });
  it('swim rounds', () => {
    const s = buildPreset('swim', base({ swimRounds: 12 }));
    expect(s.segments.length).toBe(1 + 12 + 11);
    expect(s.totalMs).toBe(10_000 + 11 * 10_000);
  });
  it('every engine preset builds and steppers are not interval presets', () => {
    for (const p of ENGINE_PRESETS) expect(buildPreset(p, base()).segments.length).toBeGreaterThan(0);
    expect(() => buildPreset('foundation', base())).toThrow();
  });
});
