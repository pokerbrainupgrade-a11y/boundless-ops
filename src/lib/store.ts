import { signal, computed } from '@preact/signals';
import { db, requestPersistentStorage, type Block, type SessionLog, type HabitLog, type Vital } from './db';
import { loadSettings } from './settings';
import { phxDate, phxHour, dayIndex, dateForDay } from './time';
import { BLOCK_DAYS } from '@/data/program';

export const todayYmd = signal(phxDate());
export const block = signal<Block | null>(null);
export const blocks = signal<Block[]>([]);
export const logs = signal<SessionLog[]>([]);
export const habitLogs = signal<HabitLog[]>([]);
export const vitals = signal<Vital[]>([]);
export const booted = signal(false);
export const persisted = signal<boolean | null>(null);

/** Program day for today: 0 before start, 1..BLOCK_DAYS in block, greater after. null with no block. */
export const dayN = computed(() => (block.value ? dayIndex(block.value.startDate, todayYmd.value, block.value.shift) : null));
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
}

export async function boot(): Promise<void> {
  await loadSettings();
  await reloadBlocks();
  await reloadLogs();
  persisted.value = await requestPersistentStorage();
  booted.value = true;
}

export async function startBlock(startDate: string): Promise<Block> {
  const prev = block.value;
  if (prev && !prev.endedAt) await db.blocks.update(prev.id!, { endedAt: new Date().toISOString() });
  const b: Block = { n: (prev?.n ?? 0) + 1, startDate, shift: 0, createdAt: new Date().toISOString() };
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

/** Missed a day: push the remaining schedule by one day. */
export async function shiftRemaining(by = 1): Promise<void> {
  const b = block.value;
  if (!b) return;
  await db.blocks.update(b.id!, { shift: b.shift + by });
  await reloadBlocks();
}

export async function saveLog(log: SessionLog): Promise<number> {
  const id = (await db.logs.put(log)) as number;
  // Keep the standing-orders checklist in sync with logged protocols.
  const ts = Date.parse(log.startedAt);
  const date = phxDate(isNaN(ts) ? Date.now() : ts);
  if (log.completed && block.value && !isNaN(ts)) {
    if (log.sessionId === 'decompression') {
      const h = phxHour(ts);
      await setHabit(h < 12 ? 'breathWake' : h < 18 ? 'breathAfternoon' : 'breathBed', true, date);
    } else if (log.sessionId === 'coldShower') await setHabit('coldShower', true, date);
    else if (log.sessionId === 'postMealWalk') await setHabit('postMealWalk', true, date);
  }
  await reloadLogs();
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

export function dateOfDay(n: number): string | null {
  const b = block.value;
  return b ? dateForDay(b.startDate, n, b.shift) : null;
}

export function blockLabel(n: number): string {
  return `Operation Block ${String(n).padStart(2, '0')}`;
}

export function dayLabel(n: number): string {
  return `Day ${String(n).padStart(2, '0')}`;
}
