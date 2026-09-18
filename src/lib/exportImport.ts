import { z } from 'zod';
import { db, type BoundlessDB } from './db';
import { SettingsSchema } from './settings';
import { StackItem, StackLogSchema, LabPanelSchema } from '@/data/stackSchema';

const BlockSchema = z.object({
  id: z.number().optional(),
  n: z.number().int(),
  startDate: z.string(),
  shift: z.number().int().default(0),
  createdAt: z.string(),
  endedAt: z.string().optional(),
});
const LogSchema = z.object({
  id: z.number().optional(),
  blockId: z.number(),
  dayN: z.number().int(),
  week: z.number().int().min(1).max(6),
  day: z.number().int(),
  slot: z.enum(['am', 'main', 'pm', 'habit']),
  sessionId: z.string(),
  variant: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string(),
  rpe: z.number().optional(),
  notes: z.string().optional(),
  hr: z.object({ avg: z.number(), max: z.number() }).optional(),
  completed: z.boolean(),
  data: z.record(z.string(), z.unknown()).default({}),
});
const HabitSchema = z.object({ id: z.number().optional(), blockId: z.number(), date: z.string(), habitId: z.string(), done: z.boolean() });
const VitalSchema = z.object({ id: z.number().optional(), date: z.string(), restingHr: z.number().optional(), hrv: z.number().optional() });

export const ExportSchema = z.object({
  app: z.literal('boundless-ops'),
  /** 1 = training only. 2 adds the supplement stack, its logs, and lab panels. */
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string(),
  settings: SettingsSchema.partial().optional(),
  blocks: z.array(BlockSchema),
  logs: z.array(LogSchema),
  habits: z.array(HabitSchema),
  vitals: z.array(VitalSchema),
  // Added in schemaVersion 2; version 1 backups still import.
  stackItems: z.array(StackItem).default([]),
  stackLogs: z.array(StackLogSchema).default([]),
  labs: z.array(LabPanelSchema).default([]),
});

/** Shown wherever a backup is produced: the file carries personal health data. */
export const EXPORT_PRIVACY_NOTICE =
  'This file contains your supplement protocol, adherence log, and lab values. Keep it somewhere private.';
export type ExportFile = z.infer<typeof ExportSchema>;

export async function buildExport(d: BoundlessDB = db): Promise<ExportFile> {
  const [blocks, logs, habits, vitals, stackItems, stackLogs, labs, settingsRow] = await Promise.all([
    d.blocks.toArray(),
    d.logs.toArray(),
    d.habits.toArray(),
    d.vitals.toArray(),
    d.stackItems.toArray(),
    d.stackLogs.toArray(),
    d.labs.toArray(),
    d.kv.get('settings'),
  ]);
  return {
    app: 'boundless-ops',
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    settings: SettingsSchema.partial().parse(settingsRow?.value ?? {}),
    blocks,
    logs,
    habits,
    vitals,
    stackItems,
    stackLogs,
    labs,
  };
}

export function exportFilename(date = new Date()): string {
  return `boundless-ops-backup-${date.toISOString().slice(0, 10)}.json`;
}

export function parseImport(text: string): { ok: true; data: ExportFile } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }
  const r = ExportSchema.safeParse(json);
  if (!r.success) return { ok: false, error: 'Not a BOUNDLESS OPS backup: ' + r.error.issues.slice(0, 3).map((i) => `${i.path.join('.')} ${i.message}`).join('; ') };
  return { ok: true, data: r.data };
}

export async function applyImport(input: ExportFile, mode: 'merge' | 'replace', d: BoundlessDB = db): Promise<void> {
  // A version 1 backup has no stack arrays at all; treat them as empty.
  const data = { ...input, stackItems: input.stackItems ?? [], stackLogs: input.stackLogs ?? [], labs: input.labs ?? [] };
  await d.transaction('rw', [d.blocks, d.logs, d.habits, d.vitals, d.stackItems, d.stackLogs, d.labs, d.kv], async () => {
    if (mode === 'replace') {
      await Promise.all([d.blocks.clear(), d.logs.clear(), d.habits.clear(), d.vitals.clear(), d.stackItems.clear(), d.stackLogs.clear(), d.labs.clear()]);
      await d.blocks.bulkAdd(data.blocks);
      await d.logs.bulkAdd(data.logs);
      await d.habits.bulkAdd(data.habits);
      await d.vitals.bulkAdd(data.vitals);
      await d.stackItems.bulkAdd(data.stackItems);
      await d.stackLogs.bulkAdd(data.stackLogs);
      await d.labs.bulkAdd(data.labs);
      if (data.settings) await d.kv.put({ key: 'settings', value: SettingsSchema.parse(data.settings) });
    } else {
      await d.blocks.bulkPut(data.blocks);
      await d.logs.bulkPut(data.logs);
      await d.habits.bulkPut(data.habits);
      await d.stackItems.bulkPut(data.stackItems);
      for (const l of data.stackLogs) {
        const existing = await d.stackLogs.where('[date+itemId]').equals([l.date, l.itemId]).first();
        if (existing) await d.stackLogs.update(existing.id!, { ...l, id: existing.id });
        else await d.stackLogs.add({ ...l, id: undefined });
      }
      for (const p of data.labs) {
        const existing = await d.labs.where('date').equals(p.date).first();
        if (existing) await d.labs.update(existing.id!, { ...p, id: existing.id });
        else await d.labs.add({ ...p, id: undefined });
      }
      // vitals are unique by date: put by date
      for (const v of data.vitals) {
        const existing = await d.vitals.where('date').equals(v.date).first();
        if (existing) await d.vitals.update(existing.id!, { ...v, id: existing.id });
        else await d.vitals.add({ ...v, id: undefined });
      }
      // settings: keep local unless missing
      const local = await d.kv.get('settings');
      if (!local && data.settings) await d.kv.put({ key: 'settings', value: SettingsSchema.parse(data.settings) });
    }
  });
}

/** Strip auto ids for equality comparison in tests. */
export function normalizeForCompare(e: ExportFile) {
  const strip = <T extends { id?: number }>(rows: T[]) => rows.map(({ id: _id, ...rest }) => rest).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  // Stack item ids are stable strings, so they are compared as-is.
  const sortById = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return { blocks: strip(e.blocks), logs: strip(e.logs), habits: strip(e.habits), vitals: strip(e.vitals), stackItems: sortById(e.stackItems), stackLogs: strip(e.stackLogs), labs: strip(e.labs) };
}
