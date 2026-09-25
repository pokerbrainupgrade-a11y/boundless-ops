import { getDay, BLOCK_DAYS } from '@/data/program';
import type { SessionLog } from './db';

export type DaySlot = 'am' | 'main' | 'pm';

/** One scheduled session on a program day, flattened with its slot. */
export interface DaySession {
  id: string;
  slot: DaySlot;
  variant?: string;
  optional: boolean;
}

/** Every session scheduled on day n, in card order (AM, MAIN, PM). */
export function daySessions(n: number): DaySession[] {
  const d = getDay(n);
  const out: DaySession[] = [];
  for (const slot of ['am', 'main', 'pm'] as const) {
    for (const r of d[slot]) out.push({ id: r.id, slot, variant: r.variant, optional: r.optional === true });
  }
  return out;
}

export function isSessionDone(logs: SessionLog[], n: number, id: string, slot: DaySlot): boolean {
  return logs.some((l) => l.dayN === n && l.sessionId === id && l.slot === slot && l.completed);
}

/** Required (non-optional) sessions on day n that have no completed log yet. */
export function remainingSessions(n: number, logs: SessionLog[]): DaySession[] {
  return daySessions(n).filter((s) => !s.optional && !isSessionDone(logs, n, s.id, s.slot));
}

/** A day is complete when every required session has a completed log. Optional sessions never block. */
export function isDayComplete(n: number, logs: SessionLog[]): boolean {
  if (n < 1 || n > BLOCK_DAYS) return false;
  return remainingSessions(n, logs).length === 0;
}

/**
 * Where an existing block stands when it has no stored current day yet:
 * the first day that is not fully complete, or BLOCK_DAYS + 1 when every day is.
 */
export function firstIncompleteDay(logs: SessionLog[]): number {
  for (let n = 1; n <= BLOCK_DAYS; n++) if (!isDayComplete(n, logs)) return n;
  return BLOCK_DAYS + 1;
}
