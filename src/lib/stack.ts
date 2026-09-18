import type { StackItem, StackLogRow, StackBlock, LabPanel } from '@/data/stackSchema';
import { BLOCK_ORDER, PANEL_INTERVAL_DAYS } from '@/data/stackSchema';
import { addDays, daysBetween } from './time';

/* ---------------- cycle math ---------------- */

export interface CycleState {
  on: boolean;
  /** 1-based day within the current on- or off-phase. */
  dayOfPhase: number;
  phaseLength: number;
}

/** Where a date falls in an on/off cycle anchored on `anchorDate` (Phoenix dates). */
export function cycleState(cycle: { onDays: number; offDays: number; anchorDate: string }, date: string): CycleState {
  const period = cycle.onDays + cycle.offDays;
  if (period <= 0) return { on: true, dayOfPhase: 1, phaseLength: 1 };
  const delta = daysBetween(cycle.anchorDate, date);
  // Positive modulo so dates before the anchor still land in the cycle.
  const pos = ((delta % period) + period) % period;
  return pos < cycle.onDays
    ? { on: true, dayOfPhase: pos + 1, phaseLength: cycle.onDays }
    : { on: false, dayOfPhase: pos - cycle.onDays + 1, phaseLength: cycle.offDays };
}

/** An item is "live" on a date when its cycle (if any) is in an on-phase. */
export function itemOnCycle(item: StackItem, date: string): boolean {
  return item.cycle ? cycleState(item.cycle, date).on : true;
}

/** Required items count toward the block total and the streak. */
export function isRequiredOn(item: StackItem, date: string): boolean {
  return !item.optional && itemOnCycle(item, date);
}

export function requiredUnits(item: StackItem): number {
  return Math.max(1, item.dose.perServing);
}

/* ---------------- logs ---------------- */

export type LogMap = Map<string, StackLogRow>;

export function logKey(date: string, itemId: string): string {
  return `${date}|${itemId}`;
}

export function indexLogs(logs: StackLogRow[]): LogMap {
  const m: LogMap = new Map();
  for (const l of logs) m.set(logKey(l.date, l.itemId), l);
  return m;
}

export function unitsTaken(log: StackLogRow | undefined, item: StackItem): number {
  if (!log) return 0;
  if (typeof log.count === 'number') return Math.min(log.count, requiredUnits(item));
  return log.taken ? requiredUnits(item) : 0;
}

export interface BlockProgress {
  block: StackBlock;
  done: number;
  total: number;
  complete: boolean;
  /** Optional items shown in the as-needed group. */
  optional: StackItem[];
  required: StackItem[];
  /** Cycle-off items, shown struck through. */
  offCycle: StackItem[];
}

export function blockProgress(items: StackItem[], logs: LogMap, date: string, block: StackBlock): BlockProgress {
  const inBlock = items.filter((i) => i.block === block).sort((a, b) => a.order - b.order);
  const required: StackItem[] = [];
  const optional: StackItem[] = [];
  const offCycle: StackItem[] = [];
  for (const i of inBlock) {
    if (!itemOnCycle(i, date)) offCycle.push(i);
    else if (i.optional) optional.push(i);
    else required.push(i);
  }
  let done = 0;
  let total = 0;
  for (const i of required) {
    total += requiredUnits(i);
    done += unitsTaken(logs.get(logKey(date, i.id)), i);
  }
  return { block, done, total, complete: total > 0 && done >= total, optional, required, offCycle };
}

export function dayProgress(items: StackItem[], logs: LogMap, date: string): BlockProgress[] {
  return BLOCK_ORDER.map((b) => blockProgress(items, logs, date, b));
}

export function dayComplete(items: StackItem[], logs: LogMap, date: string): boolean {
  const required = items.filter((i) => isRequiredOn(i, date));
  if (required.length === 0) return false;
  return required.every((i) => unitsTaken(logs.get(logKey(date, i.id)), i) >= requiredUnits(i));
}

/**
 * Consecutive complete days ending today. A day still in progress does not
 * break the streak: counting starts at yesterday when today is incomplete.
 */
export function streak(items: StackItem[], logs: LogMap, today: string, earliest?: string): number {
  if (items.length === 0) return 0;
  let cursor = dayComplete(items, logs, today) ? today : addDays(today, -1);
  let n = 0;
  const floor = earliest ?? addDays(today, -400);
  while (daysBetween(floor, cursor) >= 0 && dayComplete(items, logs, cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/* ---------------- adherence ---------------- */

export interface Adherence {
  itemId: string;
  taken: number;
  required: number;
  pct: number | null;
}

/** Per-item adherence across a date range. Partial counts included (2 of 3 = 0.67). */
export function adherence(items: StackItem[], logs: LogMap, dates: string[]): Adherence[] {
  return items.map((item) => {
    let taken = 0;
    let required = 0;
    for (const d of dates) {
      if (!isRequiredOn(item, d)) continue;
      required += requiredUnits(item);
      taken += unitsTaken(logs.get(logKey(d, item.id)), item);
    }
    return { itemId: item.id, taken, required, pct: required > 0 ? taken / required : null };
  });
}

export function lastNDates(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i)));
}

/** Per-block completion ratio for each date, for the heatmap. */
export function blockHeatmap(items: StackItem[], logs: LogMap, dates: string[]): { date: string; blocks: number[] }[] {
  return dates.map((date) => ({
    date,
    blocks: BLOCK_ORDER.map((b) => {
      const p = blockProgress(items, logs, date, b);
      return p.total === 0 ? -1 : p.done / p.total;
    }),
  }));
}

/** Actual on/off pattern for a cycled item against its schedule. */
export function cycleCompliance(item: StackItem, logs: LogMap, dates: string[]): { date: string; scheduledOn: boolean; took: boolean }[] {
  return dates.map((date) => ({
    date,
    scheduledOn: itemOnCycle(item, date),
    took: unitsTaken(logs.get(logKey(date, item.id)), item) > 0,
  }));
}

/* ---------------- inventory ---------------- */

export type InventoryLevel = 'ok' | 'amber' | 'red';
export interface InventoryState {
  daysRemaining: number;
  level: InventoryLevel;
}

/** null when the item has no inventory or the container size is not set yet. */
export function inventoryState(item: StackItem): InventoryState | null {
  const inv = item.inventory;
  if (!inv || inv.unitsPerContainer <= 0 || inv.unitsPerDay <= 0) return null;
  const daysRemaining = Math.floor((inv.containersOnHand * inv.unitsPerContainer) / inv.unitsPerDay);
  return { daysRemaining, level: daysRemaining <= 5 ? 'red' : daysRemaining <= 14 ? 'amber' : 'ok' };
}

/* ---------------- display-only rules ---------------- */

/**
 * Ceiling note, shown once the stated dose reaches half the ceiling. Display
 * only: the app never blocks a dose and never suggests changing one.
 */
export function ceilingFlag(item: StackItem): string | null {
  if (!item.ceiling) return null;
  const dose = item.dose.amountMax ?? item.dose.amount;
  if (item.dose.unit !== item.ceiling.unit) return item.ceiling.note;
  return dose >= item.ceiling.amount * 0.5 ? item.ceiling.note : null;
}

export const SEPARATION_MINUTES = 30;

/**
 * Empty-stomach items warn when checked within 30 min after a with-food item
 * logged the same day.
 */
export function separationWarning(item: StackItem, items: StackItem[], logs: StackLogRow[], atISO: string): string | null {
  if (item.requirement !== 'empty-stomach') return null;
  const at = Date.parse(atISO);
  if (!isFinite(at)) return null;
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const l of logs) {
    if (!l.taken || !l.takenAt || l.itemId === item.id) continue;
    const other = byId.get(l.itemId);
    if (!other || (other.requirement !== 'with-food' && other.requirement !== 'with-fat')) continue;
    const t = Date.parse(l.takenAt);
    if (!isFinite(t)) continue;
    const mins = (at - t) / 60_000;
    if (mins >= 0 && mins < SEPARATION_MINUTES) {
      return `${item.name} is an empty-stomach item and you logged ${other.name} with food ${Math.round(mins)} min ago. Usual spacing is about ${SEPARATION_MINUTES} min.`;
    }
  }
  return null;
}

export function fastedConflict(item: StackItem, fastedDay: boolean, fastedSessionLogged: boolean): string | null {
  if (!fastedDay || fastedSessionLogged) return null;
  if (item.requirement !== 'with-food' && item.requirement !== 'with-fat') return null;
  return 'Fasted session today is not logged yet. This one is taken with food.';
}

/* ---------------- labs ---------------- */

export interface PanelDue {
  last: string;
  due: string;
  daysUntil: number;
  overdue: boolean;
}

export function nextPanelDue(labs: LabPanel[], today: string): PanelDue | null {
  if (labs.length === 0) return null;
  const last = [...labs].sort((a, b) => a.date.localeCompare(b.date))[labs.length - 1]!.date;
  const due = addDays(last, PANEL_INTERVAL_DAYS);
  const daysUntil = daysBetween(today, due);
  return { last, due, daysUntil, overdue: daysUntil < 0 };
}

/** Target band for 25-OH-D, converted when the panel is recorded in nmol/L. */
export function vitDBand(unit: string): { low: number; high: number } {
  return unit === 'nmol/L' ? { low: 99.8, high: 149.8 } : { low: 40, high: 60 };
}

export function vitDStatus(value: number, unit: string): 'below' | 'in band' | 'above' {
  const b = vitDBand(unit);
  return value < b.low ? 'below' : value > b.high ? 'above' : 'in band';
}
