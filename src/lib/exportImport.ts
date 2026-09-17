import { z } from 'zod';
import { db, type BoundlessDB } from './db';
import { SettingsSchema } from './settings';

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
  week: z.union([z.literal(1), z.literal(2)]),
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
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  settings: SettingsSchema.partial().optional(),
  blocks: z.array(BlockSchema),
  logs: z.array(LogSchema),
  habits: z.array(HabitSchema),
  vitals: z.array(VitalSchema),
});
export type ExportFile = z.infer<typeof ExportSchema>;

export async function buildExport(d: BoundlessDB = db): Promise<ExportFile> {
  const [blocks, logs, habits, vitals, settingsRow] = await Promise.all([
    d.blocks.toArray(),
    d.logs.toArray(),
    d.habits.toArray(),
    d.vitals.toArray(),
    d.kv.get('settings'),
  ]);
  return {
    app: 'boundless-ops',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    settings: SettingsSchema.partial().parse(settingsRow?.value ?? {}),
    blocks,
    logs,
    habits,
    vitals,
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

export async function applyImport(data: ExportFile, mode: 'merge' | 'replace', d: BoundlessDB = db): Promise<void> {
  await d.transaction('rw', [d.blocks, d.logs, d.habits, d.vitals, d.kv], async () => {
    if (mode === 'replace') {
      await Promise.all([d.blocks.clear(), d.logs.clear(), d.habits.clear(), d.vitals.clear()]);
      await d.blocks.bulkAdd(data.blocks);
      await d.logs.bulkAdd(data.logs);
      await d.habits.bulkAdd(data.habits);
      await d.vitals.bulkAdd(data.vitals);
      if (data.settings) await d.kv.put({ key: 'settings', value: SettingsSchema.parse(data.settings) });
    } else {
      await d.blocks.bulkPut(data.blocks);
      await d.logs.bulkPut(data.logs);
      await d.habits.bulkPut(data.habits);
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
  return { blocks: strip(e.blocks), logs: strip(e.logs), habits: strip(e.habits), vitals: strip(e.vitals) };
}
