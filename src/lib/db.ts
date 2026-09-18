import Dexie, { type EntityTable } from 'dexie';

export interface Block {
  id?: number;
  /** Operation Block number, 1-based. */
  n: number;
  startDate: string; // YYYY-MM-DD (Phoenix)
  /** Days the remaining schedule has been shifted (missed days). */
  shift: number;
  createdAt: string;
  endedAt?: string;
}

export interface HR {
  avg: number;
  max: number;
}

export type Slot = 'am' | 'main' | 'pm' | 'habit';

export interface SessionLog {
  id?: number;
  blockId: number;
  dayN: number; // 1..42
  week: number; // 1..6
  day: number; // 1..7
  slot: Slot;
  sessionId: string;
  variant?: string;
  startedAt: string; // ISO
  endedAt: string; // ISO
  rpe?: number;
  notes?: string;
  hr?: HR;
  completed: boolean;
  /** Preset-specific data (rounds, lifts, minutes, etc.). */
  data: Record<string, unknown>;
}

export interface HabitLog {
  id?: number;
  blockId: number;
  date: string; // YYYY-MM-DD
  habitId: string;
  done: boolean;
}

export interface Vital {
  id?: number;
  date: string; // YYYY-MM-DD
  restingHr?: number;
  hrv?: number;
}

export interface KV {
  key: string;
  value: unknown;
}

export class BoundlessDB extends Dexie {
  blocks!: EntityTable<Block, 'id'>;
  logs!: EntityTable<SessionLog, 'id'>;
  habits!: EntityTable<HabitLog, 'id'>;
  vitals!: EntityTable<Vital, 'id'>;
  kv!: EntityTable<KV, 'key'>;

  constructor(name = 'boundless-ops') {
    super(name);
    this.version(1).stores({
      blocks: '++id, n, startDate',
      logs: '++id, blockId, dayN, sessionId, startedAt, [blockId+dayN], [blockId+sessionId]',
      habits: '++id, blockId, date, habitId, [blockId+date], [date+habitId]',
      vitals: '++id, &date',
      kv: '&key',
    });
  }
}

export const db = new BoundlessDB();

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}

export async function isPersisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}

export async function recordCounts(d: BoundlessDB = db): Promise<{ blocks: number; logs: number; habits: number; vitals: number }> {
  const [blocks, logs, habits, vitals] = await Promise.all([d.blocks.count(), d.logs.count(), d.habits.count(), d.vitals.count()]);
  return { blocks, logs, habits, vitals };
}
