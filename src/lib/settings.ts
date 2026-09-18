import { signal, effect } from '@preact/signals';
import { z } from 'zod';
import { db } from './db';

export const SettingsSchema = z.object({
  /** Callsign: display name, local only. */
  callsign: z.string().default(''),
  age: z.number().nullable().default(null),
  sound: z.boolean().default(true),
  flash: z.boolean().default(true),
  volume: z.number().min(0).max(1).default(0.8),
  leadInSec: z.number().int().min(0).max(60).default(10),
  repLengthSec: z.number().int().min(30).max(60).default(40),
  silentSwitchWarned: z.boolean().default(false),
  lastExportAt: z.string().nullable().default(null),
  /** Stack module: times each block is due, used for the due-state badges. */
  blockTimes: z.record(z.string(), z.string()).default({ wake: '06:30', breakfast: '07:30', midday: '12:30', bedtime: '21:30' }),
  /** Overrides the cycle anchor date carried by the seed. */
  cycleAnchor: z.string().nullable().default(null),
  inventoryOn: z.boolean().default(false),
  stackImportedAt: z.string().nullable().default(null),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});
export const settings = signal<Settings>(DEFAULT_SETTINGS);
export const settingsLoaded = signal(false);

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  try {
    const row = await db.kv.get(KEY);
    const parsed = SettingsSchema.safeParse(row?.value ?? {});
    settings.value = parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    settings.value = DEFAULT_SETTINGS;
  }
  settingsLoaded.value = true;
  return settings.value;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  settings.value = { ...settings.value, ...patch };
  await db.kv.put({ key: KEY, value: settings.value });
}

/** Estimated HRmax = 208 − 0.7 × age. */
export function hrMax(age: number | null): number | null {
  if (!age || age < 5) return null;
  return Math.round(208 - 0.7 * age);
}

// keep audio module in sync
effect(() => {
  const s = settings.value;
  void import('./audio').then((a) => a.setAudio({ volume: s.volume, enabled: s.sound }));
});
