import raw from './program.json';
import { Program as ProgramSchema, type Program, type Session, type Day, type FoundationExercise } from './schema';

/** Program content, validated against the Zod schema at build time (the build fails on an invalid file). */
export const program: Program = ProgramSchema.parse(raw);

export function getSession(id: string): Session {
  const s = program.sessions[id];
  if (!s) throw new Error(`Unknown session ${id}`);
  return s;
}

export function getDay(n: number): Day {
  const d = program.days[n - 1];
  if (!d) throw new Error(`Unknown day ${n}`);
  return d;
}

export const foundationExercises: Record<string, FoundationExercise> = Object.fromEntries(
  [...program.foundation.seqA, ...program.foundation.seqB].map((e) => [e.id, e]),
);

export function foundationSequence(seq: 'A' | 'B' | 'applied'): FoundationExercise[] {
  if (seq === 'A') return program.foundation.seqA;
  if (seq === 'B') return program.foundation.seqB;
  return [];
}

export interface SevenMove { id: string; name: string; cue: string; drawingId: string; isometric: boolean }

/** Every seven-minute move by id, including the W2 explosive swaps. */
export const sevenMinuteMoves: Record<string, SevenMove> = Object.fromEntries(
  [
    ...program.sevenMinute.map((m) => [m.id, { id: m.id, name: m.name, cue: m.cue, drawingId: m.drawingId, isometric: !!m.isometric }]),
    ...program.sevenMinute.filter((m) => m.w2Swap).map((m) => [m.w2Swap!.id, { ...m.w2Swap!, isometric: false }]),
  ] as [string, SevenMove][],
);

export const tabataMovements = Object.fromEntries(program.tabataMovements.map((m) => [m.id, m]));

/** Every drawing id referenced by the program. */
export function allDrawingIds(): string[] {
  const ids = new Set<string>();
  Object.values(program.sessions).forEach((s) => ids.add(s.drawingId));
  [...program.foundation.seqA, ...program.foundation.seqB].forEach((e) => {
    ids.add(e.drawingId);
    e.frames?.forEach((f) => ids.add(f));
  });
  program.mobilityStations.forEach((s) => ids.add(s.rollDrawingId));
  program.sevenMinute.forEach((m) => {
    ids.add(m.drawingId);
    if (m.w2Swap) ids.add(m.w2Swap.drawingId);
  });
  program.superSlowPatterns.forEach((p) => ids.add(p.drawingId));
  program.tabataMovements.forEach((m) => ids.add(m.drawingId));
  return [...ids].sort();
}
