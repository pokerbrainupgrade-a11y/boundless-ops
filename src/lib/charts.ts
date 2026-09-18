import type { SessionLog, Vital, Block } from './db';
import { BLOCK_WEEKS } from '@/data/program';

export type ChartMode = 'weeks' | 'blocks';

export interface Point {
  x: string;
  y: number | null;
  /** extra label */
  note?: string;
}
export interface Series {
  name: string;
  points: Point[];
  color: string;
}
export interface ChartData {
  id: string;
  title: string;
  unit?: string;
  kind: 'bar' | 'line';
  series: Series[];
  empty?: string;
}

const COLORS = ['var(--signal)', 'var(--tan)', 'var(--rest-hi)', 'var(--text)', '#E8A04B', '#8FA3B5'];

/** Group logs into comparison groups: one per week of a block, or one group per block. */
export function groups(logs: SessionLog[], blocks: Block[], mode: ChartMode, blockId: number | null): { name: string; logs: SessionLog[] }[] {
  if (mode === 'weeks') {
    const ls = logs.filter((l) => blockId === null || l.blockId === blockId);
    return Array.from({ length: BLOCK_WEEKS }, (_, i) => ({ name: `Week ${i + 1}`, logs: ls.filter((l) => l.week === i + 1) }));
  }
  return blocks.map((b) => ({ name: `Block ${String(b.n).padStart(2, '0')}`, logs: logs.filter((l) => l.blockId === b.id) }));
}

const n = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

export function buildCharts(logs: SessionLog[], blocks: Block[], vitals: Vital[], mode: ChartMode, blockId: number | null): ChartData[] {
  const gs = groups(logs, blocks, mode, blockId);
  const done = (ls: SessionLog[], id: string) => ls.filter((l) => l.sessionId === id && l.completed);
  const out: ChartData[] = [];

  // Tabata total per session
  out.push({
    id: 'tabata-total', title: 'Tabata total', unit: 'reps / cals', kind: 'bar',
    series: gs.map((g, i) => ({ name: g.name, color: COLORS[i % COLORS.length]!, points: done(g.logs, 'A').map((l) => ({ x: `D${l.day}`, y: n(l.data.total), note: String(l.data.movement ?? '') })) })),
  });
  // Tabata per-round drop-off (line per session, points = rounds)
  out.push({
    id: 'tabata-rounds', title: 'Tabata per-round drop-off', unit: 'per round', kind: 'line',
    series: gs.flatMap((g, i) => done(g.logs, 'A').map((l, k) => ({ name: `${g.name} D${l.day}`, color: COLORS[(i * 3 + k) % COLORS.length]!, points: ((l.data.rounds as (number | null)[]) ?? []).slice(0, 8).map((r, j) => ({ x: `R${j + 1}`, y: n(r) })) }))),
  });
  // Super-slow seconds to failure and load per lift
  const patterns = ['upperPush', 'upperPull', 'lowerPush', 'lowerPull'];
  const pname: Record<string, string> = { upperPush: 'Push', upperPull: 'Pull', lowerPush: 'Squat', lowerPull: 'Hinge' };
  for (const [key, title, unit] of [['seconds', 'Super-slow seconds to failure', 's'], ['load', 'Super-slow load per lift', 'load']] as const) {
    out.push({
      id: `superslow-${key}`, title, unit, kind: 'bar',
      series: gs.map((g, i) => {
        const l = done(g.logs, 'F')[0];
        const lifts = (l?.data.lifts as { pattern: string; seconds?: number; load?: number }[] | undefined) ?? [];
        return { name: g.name, color: COLORS[i % COLORS.length]!, points: patterns.map((p) => ({ x: pname[p]!, y: n(lifts.find((x) => x.pattern === p)?.[key]) })) };
      }),
    });
  }
  // 5x4 avg HR per round
  out.push({
    id: 'vo2-hr', title: '5x4 average HR per round', unit: 'bpm', kind: 'line',
    series: gs.flatMap((g, i) => done(g.logs, 'H').map((l) => ({ name: g.name, color: COLORS[i % COLORS.length]!, points: ((l.data.rounds as (number | null)[]) ?? []).slice(0, 5).map((r, j) => ({ x: `R${j + 1}`, y: n(r) })) }))),
  });
  // Sauna minutes
  out.push({
    id: 'sauna', title: 'Sauna minutes', unit: 'min', kind: 'bar',
    series: gs.map((g, i) => ({ name: g.name, color: COLORS[i % COLORS.length]!, points: done(g.logs, 'I').map((l) => ({ x: `D${l.day}`, y: n(l.data.minutes) })) })),
  });
  // Stamina duration / HR
  out.push({
    id: 'stamina', title: 'Stamina duration and avg HR', unit: 'min · bpm', kind: 'bar',
    series: gs.flatMap((g, i) => {
      const ls = done(g.logs, 'L');
      return [
        { name: `${g.name} min`, color: COLORS[i % COLORS.length]!, points: ls.map((l) => ({ x: `D${l.day}`, y: n(l.data.durationMin) })) },
        { name: `${g.name} HR`, color: COLORS[(i + 2) % COLORS.length]!, points: ls.map((l) => ({ x: `D${l.day}`, y: n(l.data.avgHr) ?? n(l.hr?.avg) })) },
      ];
    }),
  });
  // Cold dose
  out.push({
    id: 'cold', title: 'Cold dose', unit: 'shower days · immersion min · °F', kind: 'bar',
    series: gs.flatMap((g, i) => {
      const showers = new Set(done(g.logs, 'coldShower').map((l) => l.dayN)).size;
      const imm = done(g.logs, 'coldImmersion');
      return [
        { name: `${g.name} shower days`, color: COLORS[i % COLORS.length]!, points: [{ x: 'showers', y: showers }] },
        { name: `${g.name} immersion`, color: COLORS[(i + 1) % COLORS.length]!, points: imm.map((l) => ({ x: `D${l.day} min`, y: n(l.data.minutes) })) },
        { name: `${g.name} water °F`, color: COLORS[(i + 3) % COLORS.length]!, points: imm.map((l) => ({ x: `D${l.day} °F`, y: n(l.data.waterF) })) },
      ];
    }),
  });
  // Resting HR / HRV trend (by date, not grouped)
  const vs = [...vitals].sort((a, b) => a.date.localeCompare(b.date));
  out.push({
    id: 'vitals', title: 'Resting HR and HRV trend', unit: 'bpm · ms', kind: 'line',
    series: [
      { name: 'Resting HR', color: COLORS[0]!, points: vs.map((v) => ({ x: v.date.slice(5), y: n(v.restingHr) })) },
      { name: 'HRV', color: COLORS[1]!, points: vs.map((v) => ({ x: v.date.slice(5), y: n(v.hrv) })) },
    ],
  });
  return out;
}

export function hasData(c: ChartData): boolean {
  return c.series.some((s) => s.points.some((p) => p.y !== null));
}

