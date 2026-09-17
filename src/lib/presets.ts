import { program, sevenMinuteMoves } from '@/data/program';
import type { TimerPreset } from '@/data/schema';
import { prep, rounds, type Segment } from './engine';

export interface PresetOptions {
  leadInSec: number;
  week: 1 | 2;
  tabataMove?: string;
  sevenRounds?: number;
  sprintVariant?: 'G1' | 'G2' | 'G3';
  minutes?: number;
  cycles?: number;
  restSec?: number;
  swimRounds?: number;
}

export interface BuiltPreset {
  segments: Segment[];
  title: string;
  totalMs: number;
  meta: Record<string, unknown>;
}

export const ENGINE_PRESETS: TimerPreset[] = ['tabata', 'vo2', 'sprints', 'sevenMinute', 'superSlow', 'coldShower', 'coldImmersion', 'sauna', 'contrast', 'stamina', 'countdown', 'swim'];
export const STEPPER_PRESETS: TimerPreset[] = ['foundation', 'mobility', 'decompression'];

/** Timer-state copy: STAND BY / GO / RECOVER / MISSION COMPLETE. */
export const STATE_COPY = { prep: 'STAND BY', work: 'GO', rest: 'RECOVER', transition: 'NEXT UP', done: 'MISSION COMPLETE' } as const;

function finish(segments: Segment[], title: string, meta: Record<string, unknown> = {}): BuiltPreset {
  return { segments, title, totalMs: segments.reduce((a, s) => a + (s.open ? 0 : s.durationMs), 0), meta };
}

function lead(o: PresetOptions): Segment[] {
  return o.leadInSec > 0 ? [prep(o.leadInSec, STATE_COPY.prep)] : [];
}

/** Which seven-minute moves run this week (W2 uses the explosive swaps). */
export function sevenMinuteSequence(week: 1 | 2) {
  return program.sevenMinute.map((m) => {
    const id = week === 2 && m.w2Swap ? m.w2Swap.id : m.id;
    const move = sevenMinuteMoves[id]!;
    return { ...move, baseId: m.id, swapped: id !== m.id };
  });
}

export function tabataMoves() {
  return program.tabataMovements;
}

export function superSlowOptions(patternId: string): string[] {
  return program.superSlowPatterns.find((p) => p.id === patternId)!.options;
}

export function buildPreset(preset: TimerPreset, o: PresetOptions): BuiltPreset {
  switch (preset) {
    case 'tabata': {
      const moves = tabataMoves();
      const move = moves.find((m) => m.id === o.tabataMove) ?? moves[0]!;
      const segs = [...lead(o), ...rounds(8, { label: STATE_COPY.work, durationMs: 20_000, cue: `${move.name} · all out` }, { label: STATE_COPY.rest, durationMs: 10_000, logPrompt: move.unit, meta: { unit: move.unit } })];
      return finish(segs, 'Tabata', { move: move.id, unit: move.unit });
    }
    case 'vo2': {
      const segs = [...lead(o), ...rounds(5, { label: STATE_COPY.work, durationMs: 240_000, cue: '87–97% HRmax' }, { label: 'EASY', durationMs: 240_000, cue: 'Rest or easy movement', logPrompt: 'avgHr' })];
      return finish(segs, '5x4 VO2 max', {});
    }
    case 'sprints': {
      const v = o.sprintVariant ?? 'G1';
      let segs: Segment[];
      if (v === 'G1') segs = rounds(4, { label: 'ALL OUT', durationMs: 30_000, cue: 'Rower, bike, or elliptical' }, { label: 'ACTIVE REST', durationMs: 240_000, cue: 'Easy walk, jog, or spin', logPrompt: 'sprint' });
      else if (v === 'G2') segs = rounds(5, { label: 'SPRINT', durationMs: 4_000 }, { label: STATE_COPY.rest, durationMs: 20_000, logPrompt: 'sprint' });
      else {
        segs = [];
        for (let set = 1; set <= 3; set++) {
          segs.push(...rounds(5, { label: 'SPRINT', durationMs: 4_000, meta: { set } }, { label: STATE_COPY.rest, durationMs: 20_000, meta: { set }, logPrompt: 'sprint' }));
          if (set < 3) segs.push({ label: 'SET BREAK', kind: 'transition', durationMs: 60_000, meta: { set } });
        }
      }
      return finish([...lead(o), ...segs], `Sprints ${v}`, { variant: v });
    }
    case 'sevenMinute': {
      const n = Math.min(3, Math.max(1, o.sevenRounds ?? 1));
      const seq = sevenMinuteSequence(o.week);
      const segs: Segment[] = [...lead(o)];
      for (let r = 1; r <= n; r++) {
        seq.forEach((m, i) => {
          const next = seq[(i + 1) % seq.length]!;
          const last = r === n && i === seq.length - 1;
          segs.push({ label: m.name.toUpperCase(), kind: 'work', durationMs: 30_000, cue: m.cue, meta: { moveId: m.id, next: last ? null : next.id, round: r, of: n, i, isometric: m.isometric } });
          if (!last) segs.push({ label: 'NEXT UP', kind: 'transition', durationMs: 10_000, cue: next.name, meta: { moveId: next.id, next: next.id, round: r, of: n, i, transition: true } });
        });
      }
      return finish(segs, '7-Minute Workout', { rounds: n, moves: seq.map((m) => m.id), explosive: o.week === 2 });
    }
    case 'superSlow': {
      const rest = Math.min(120, Math.max(60, o.restSec ?? 90));
      const segs: Segment[] = [...lead(o)];
      program.superSlowPatterns.forEach((p, i) => {
        segs.push({ label: 'TO FAILURE', kind: 'work', durationMs: 0, open: true, cue: p.name, meta: { pattern: p.id, lift: i + 1 }, logPrompt: 'lift' });
        if (i < program.superSlowPatterns.length - 1) segs.push({ label: STATE_COPY.rest, kind: 'rest', durationMs: rest * 1000, cue: 'Next: ' + program.superSlowPatterns[i + 1]!.name, meta: { pattern: p.id, lift: i + 1 } });
      });
      return finish(segs, 'Super-Slow Strength', { restSec: rest });
    }
    case 'coldShower': {
      const segs = [...lead(o), ...rounds(10, { label: 'WARM', durationMs: 10_000 }, { label: 'COLD', durationMs: 20_000 })];
      return finish(segs, 'Cold Shower Cycle');
    }
    case 'coldImmersion': {
      const min = Math.min(5, Math.max(2, o.minutes ?? 3));
      return finish([...lead(o), { label: 'IN THE COLD', kind: 'rest', durationMs: min * 60_000, cue: '≤ 55°F' }], 'Cold Immersion', { minutes: min });
    }
    case 'sauna': {
      const min = Math.min(40, Math.max(20, o.minutes ?? 20));
      return finish([...lead(o), { label: 'BREATHE', kind: 'work', durationMs: min * 60_000, cue: 'Box breathing 4-4-4-4' }], 'Sauna', { minutes: min, box: true, finishCold: true });
    }
    case 'contrast': {
      const c = Math.min(3, Math.max(2, o.cycles ?? 2));
      const segs = [...lead(o), ...rounds(c, { label: 'HOT', durationMs: 600_000, cue: 'Sauna' }, { label: 'COLD', durationMs: 300_000, cue: '≤ 55°F · end on cold' })];
      return finish(segs, 'Hot-Cold Contrast', { cycles: c });
    }
    case 'stamina': {
      const min = Math.min(600, Math.max(20, o.minutes ?? 120));
      return finish([...lead(o), { label: 'STEADY', kind: 'work', durationMs: min * 60_000, cue: 'Conversational the whole time · 60–70% HRmax' }], 'Stamina Session', { minutes: min, halfwayMs: (min * 60_000) / 2, hydrateEveryMs: 20 * 60_000 });
    }
    case 'countdown': {
      const min = Math.max(1, o.minutes ?? 20);
      return finish([...lead(o), { label: 'EASY', kind: 'work', durationMs: min * 60_000 }], 'Countdown', { minutes: min });
    }
    case 'swim': {
      const n = Math.min(12, Math.max(10, o.swimRounds ?? 10));
      const segs: Segment[] = [...lead(o)];
      for (let i = 1; i <= n; i++) {
        segs.push({ label: 'SWIM 25 m', kind: 'work', durationMs: 0, open: true, cue: 'Breathe as seldom as is comfortable', meta: { round: i, of: n } });
        if (i < n) segs.push({ label: STATE_COPY.rest, kind: 'rest', durationMs: 10_000, meta: { round: i, of: n } });
      }
      return finish(segs, 'Hypoxic Swim', { rounds: n });
    }
    case 'foundation':
    case 'mobility':
    case 'decompression':
    case 'none':
      throw new Error(`${preset} is a stepper, not an interval preset`);
  }
}
