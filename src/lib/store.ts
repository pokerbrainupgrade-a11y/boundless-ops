import { signal, computed } from '@preact/signals';
import { db, requestPersistentStorage, type Block, type SessionLog, type HabitLog, type Vital } from './db';
import { loadSettings, settings, updateSettings } from './settings';
import type { StackItem, StackLogRow, LabPanel, StackSeed } from '@/data/stackSchema';
import { indexLogs } from './stack';
import { phxDate, phxHour, dayIndex } from './time';
import { BLOCK_DAYS, getDay } from '@/data/program';
import { firstIncompleteDay, isDayComplete, remainingSessions } from './progress';

export const todayYmd = signal(phxDate());
export const block = signal<Block | null>(null);
export const blocks = signal<Block[]>([]);
export const logs = signal<SessionLog[]>([]);
export const habitLogs = signal<HabitLog[]>([]);
export const vitals = signal<Vital[]>([]);
export const booted = signal(false);
export const persisted = signal<boolean | null>(null);

/**
 * Program day Today shows: 0 or less before the start date, 1..BLOCK_DAYS in the block,
 * BLOCK_DAYS + 1 once every day is complete. null with no block.
 * The day does not follow the calendar; it advances when the day's required sessions are logged.
 */
export const dayN = computed(() => {
  const b = block.value;
  if (!b) return null;
  const untilStart = dayIndex(b.startDate, todayYmd.value);
  if (untilStart < 1) return untilStart;
  return b.currentDay ?? 1;
});
export const inBlock = computed(() => dayN.value !== null && dayN.value >= 1 && dayN.value <= BLOCK_DAYS);

function refreshToday() {
  const t = phxDate();
  if (t !== todayYmd.value) todayYmd.value = t;
}
if (typeof window !== 'undefined') {
  setInterval(refreshToday, 30_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refreshToday());
}

export async function reloadBlocks(): Promise<void> {
  const all = await db.blocks.orderBy('n').toArray();
  blocks.value = all;
  block.value = all.length ? all[all.length - 1]! : null;
}

export async function reloadLogs(): Promise<void> {
  const b = block.value;
  logs.value = b ? await db.logs.where('blockId').equals(b.id!).toArray() : [];
  habitLogs.value = b ? await db.habits.where('blockId').equals(b.id!).toArray() : [];
  vitals.value = await db.vitals.orderBy('date').toArray();
  await ensureCurrentDay();
}

/** Blocks from before Today was completion-gated have no current day: pick up at the first incomplete day. */
async function ensureCurrentDay(): Promise<void> {
  const b = block.value;
  if (!b || b.currentDay !== undefined) return;
  const currentDay = firstIncompleteDay(logs.value);
  await db.blocks.update(b.id!, { currentDay });
  await reloadBlocks();
}

export async function boot(): Promise<void> {
  await loadSettings();
  await reloadBlocks();
  await reloadLogs();
  await reloadStack();
  await loadStackMeta();
  persisted.value = await requestPersistentStorage();
  booted.value = true;
}

export async function startBlock(startDate: string): Promise<Block> {
  const prev = block.value;
  if (prev && !prev.endedAt) await db.blocks.update(prev.id!, { endedAt: new Date().toISOString() });
  const b: Block = { n: (prev?.n ?? 0) + 1, startDate, shift: 0, currentDay: 1, createdAt: new Date().toISOString() };
  b.id = (await db.blocks.add(b)) as number;
  await reloadBlocks();
  await reloadLogs();
  return b;
}

export async function setStartDate(startDate: string): Promise<void> {
  const b = block.value;
  if (!b) {
    await startBlock(startDate);
    return;
  }
  await db.blocks.update(b.id!, { startDate, shift: 0 });
  await reloadBlocks();
}

/** Move Today to program day n (1..BLOCK_DAYS + 1). Used by Complete All, auto-advance, and the Schedule jump control. */
export async function setCurrentDay(n: number): Promise<void> {
  const b = block.value;
  if (!b) return;
  const currentDay = Math.max(1, Math.min(BLOCK_DAYS + 1, Math.round(n)));
  await db.blocks.update(b.id!, { currentDay });
  await reloadBlocks();
}

/** Required sessions still open on the current day. Empty when the day is done or Today is not in the block. */
export const remainingToday = computed(() => {
  const n = dayN.value;
  return n !== null && n >= 1 && n <= BLOCK_DAYS ? remainingSessions(n, logs.value) : [];
});

/**
 * Complete All: log every required session on day n that is still open, then move Today to the next day.
 * Bulk logs carry `data.completeAll` so the AAR can tell them from timed sessions.
 */
export async function completeDay(n: number): Promise<void> {
  const b = block.value;
  if (!b || n < 1 || n > BLOCK_DAYS) return;
  const d = getDay(n);
  const now = new Date().toISOString();
  const rows: SessionLog[] = remainingSessions(n, logs.value).map((s) => ({
    blockId: b.id!,
    dayN: n,
    week: d.week,
    day: d.day,
    slot: s.slot,
    sessionId: s.id,
    variant: s.variant,
    startedAt: now,
    endedAt: now,
    completed: true,
    data: { completeAll: true },
  }));
  if (rows.length) await db.logs.bulkAdd(rows);
  for (const row of rows) await syncHabit(row);
  if (b.currentDay === n || b.currentDay === undefined) await db.blocks.update(b.id!, { currentDay: n + 1 });
  await reloadBlocks();
  await reloadLogs();
}

/** Keep the standing-orders checklist in sync with logged protocols. */
async function syncHabit(log: SessionLog): Promise<void> {
  const ts = Date.parse(log.startedAt);
  if (!log.completed || !block.value || isNaN(ts)) return;
  const date = phxDate(ts);
  if (log.sessionId === 'decompression') {
    const h = phxHour(ts);
    await setHabit(h < 12 ? 'breathWake' : h < 18 ? 'breathAfternoon' : 'breathBed', true, date);
  } else if (log.sessionId === 'coldShower') await setHabit('coldShower', true, date);
  else if (log.sessionId === 'postMealWalk') await setHabit('postMealWalk', true, date);
}

export async function saveLog(log: SessionLog): Promise<number> {
  const id = (await db.logs.put(log)) as number;
  await syncHabit(log);
  await reloadLogs();
  // Logging the last required session of the current day moves Today to the next day.
  const b = block.value;
  if (b && log.completed && log.blockId === b.id && log.dayN === b.currentDay && isDayComplete(log.dayN, logs.value)) {
    await setCurrentDay(log.dayN + 1);
  }
  return id;
}

export async function deleteLog(id: number): Promise<void> {
  await db.logs.delete(id);
  await reloadLogs();
}

export function logsFor(dayNumber: number, sessionId?: string, slot?: string): SessionLog[] {
  return logs.value.filter((l) => l.dayN === dayNumber && (!sessionId || l.sessionId === sessionId) && (!slot || l.slot === slot));
}

export function habitDone(habitId: string, date = todayYmd.value): boolean {
  return habitLogs.value.some((h) => h.habitId === habitId && h.date === date && h.done);
}

export async function toggleHabit(habitId: string, date = todayYmd.value): Promise<void> {
  const b = block.value;
  if (!b) return;
  const existing = await db.habits.where('[date+habitId]').equals([date, habitId]).first();
  if (existing) await db.habits.update(existing.id!, { done: !existing.done });
  else await db.habits.add({ blockId: b.id!, date, habitId, done: true });
  await reloadLogs();
}

export async function setHabit(habitId: string, done: boolean, date = todayYmd.value): Promise<void> {
  const b = block.value;
  if (!b) return;
  const existing = await db.habits.where('[date+habitId]').equals([date, habitId]).first();
  if (existing) await db.habits.update(existing.id!, { done });
  else if (done) await db.habits.add({ blockId: b.id!, date, habitId, done: true });
  await reloadLogs();
}

export async function saveVital(v: Vital): Promise<void> {
  const existing = await db.vitals.where('date').equals(v.date).first();
  if (existing) await db.vitals.update(existing.id!, { ...v, id: existing.id });
  else await db.vitals.add(v);
  await reloadLogs();
}

/**
 * Calendar date program day n was (or is being) trained on: the earliest completed log for
 * that day, else today for the current day, else the start date for Day 01 before the block
 * opens. Null for days not reached yet: the schedule no longer promises them a date.
 */
export function dateOfDay(n: number): string | null {
  const b = block.value;
  if (!b) return null;
  let first: string | null = null;
  for (const l of logs.value) {
    if (l.dayN !== n || !l.completed) continue;
    const ts = Date.parse(l.startedAt);
    if (isNaN(ts)) continue;
    const d = phxDate(ts);
    if (first === null || d < first) first = d;
  }
  if (first) return first;
  const cur = dayN.value;
  if (cur !== null && cur < 1) return n === 1 ? b.startDate : null;
  return n === cur ? todayYmd.value : null;
}

export function blockLabel(n: number): string {
  return `Operation Block ${String(n).padStart(2, '0')}`;
}

export function dayLabel(n: number): string {
  return `Day ${String(n).padStart(2, '0')}`;
}

/* ---------------- supplement stack ---------------- */

export const stackItems = signal<StackItem[]>([]);
export const stackLogs = signal<StackLogRow[]>([]);
export const labs = signal<LabPanel[]>([]);

/** Items with the settings cycle-anchor override applied. */
export const stackItemsResolved = computed(() => {
  const anchor = settings.value.cycleAnchor;
  if (!anchor) return stackItems.value;
  return stackItems.value.map((i) => (i.cycle ? { ...i, cycle: { ...i.cycle, anchorDate: anchor } } : i));
});

export const stackLogIndex = computed(() => indexLogs(stackLogs.value));

export async function reloadStack(): Promise<void> {
  const [items, logRows, panels] = await Promise.all([
    db.stackItems.toArray(),
    db.stackLogs.toArray(),
    db.labs.orderBy('date').toArray(),
  ]);
  stackItems.value = items.sort((a, b) => (a.block === b.block ? a.order - b.order : 0));
  stackLogs.value = logRows;
  labs.value = panels;
}

/** Replace the whole stack with an imported seed. Logs and labs are kept. */
export async function importStackSeed(seed: StackSeed): Promise<void> {
  await db.transaction('rw', [db.stackItems, db.kv], async () => {
    await db.stackItems.clear();
    await db.stackItems.bulkAdd(seed.items);
    await db.kv.put({ key: 'stackMeta', value: { title: seed.title, notes: seed.notes, blocks: seed.blocks } });
  });
  await updateSettings({ stackImportedAt: new Date().toISOString() });
  await reloadStack();
  await loadStackMeta();
}

export interface StackMeta {
  title: string;
  notes: { title: string; text: string }[];
  blocks: { block: string; label: string; rule: string; defaultTime: string }[];
}
export const stackMeta = signal<StackMeta | null>(null);

export async function loadStackMeta(): Promise<void> {
  const row = await db.kv.get('stackMeta');
  stackMeta.value = (row?.value as StackMeta | undefined) ?? null;
}

/** Set the units taken for an item on a date. `units` of 0 clears the log. */
export async function setStackCount(item: StackItem, units: number, date = todayYmd.value, opts: { offDayOverride?: boolean } = {}): Promise<void> {
  const full = Math.max(1, item.dose.perServing);
  const count = Math.max(0, Math.min(full, Math.round(units)));
  const existing = await db.stackLogs.where('[date+itemId]').equals([date, item.id]).first();
  if (count === 0) {
    if (existing) await db.stackLogs.delete(existing.id!);
  } else {
    const row: StackLogRow = {
      date,
      itemId: item.id,
      taken: count >= full,
      count,
      takenAt: new Date().toISOString(),
      ...(opts.offDayOverride ? { offDayOverride: true } : {}),
    };
    if (existing) await db.stackLogs.update(existing.id!, { ...row, id: existing.id });
    else await db.stackLogs.add(row);
  }
  await reloadStack();
}

export async function toggleStackItem(item: StackItem, date = todayYmd.value, opts: { offDayOverride?: boolean } = {}): Promise<void> {
  const full = Math.max(1, item.dose.perServing);
  const cur = stackLogIndex.value.get(`${date}|${item.id}`);
  const taken = cur ? (typeof cur.count === 'number' ? cur.count : cur.taken ? full : 0) : 0;
  await setStackCount(item, taken >= full ? 0 : full, date, opts);
}

export async function saveStackItem(item: StackItem): Promise<void> {
  await db.stackItems.put(item);
  await reloadStack();
}

export async function deleteStackItem(id: string): Promise<void> {
  await db.stackItems.delete(id);
  await reloadStack();
}

export async function saveLabPanel(panel: LabPanel): Promise<void> {
  const existing = await db.labs.where('date').equals(panel.date).first();
  if (existing) await db.labs.update(existing.id!, { ...panel, id: existing.id });
  else await db.labs.add(panel);
  await reloadStack();
}

export async function deleteLabPanel(id: number): Promise<void> {
  await db.labs.delete(id);
  await reloadStack();
}

/** Logged a refill: one more container on hand, stamped today. */
export async function logRefill(item: StackItem): Promise<void> {
  if (!item.inventory) return;
  await saveStackItem({
    ...item,
    inventory: { ...item.inventory, containersOnHand: item.inventory.containersOnHand + 1, lastRefillDate: todayYmd.value },
  });
}
