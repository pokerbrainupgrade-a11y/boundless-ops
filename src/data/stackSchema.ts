import { z } from 'zod';

/**
 * Supplement stack schema. The committed repo ships this schema and the generic
 * ingredient dictionary only; the protocol itself (names, brands, doses, labs)
 * is personal health data and lives on-device after a local seed import.
 */

export const StackBlock = z.enum(['wake', 'breakfast', 'midday', 'bedtime']);
export type StackBlock = z.infer<typeof StackBlock>;
export const BLOCK_ORDER: StackBlock[] = ['wake', 'breakfast', 'midday', 'bedtime'];

export const Requirement = z.enum(['empty-stomach', 'with-food', 'with-fat', 'any']);
export type Requirement = z.infer<typeof Requirement>;

export const OptionalTrigger = z.enum(['high-load-day', 'some-days']);
export type OptionalTrigger = z.infer<typeof OptionalTrigger>;

export const Dose = z.object({
  amount: z.number().nonnegative(),
  /** Top of a range, when the protocol states one (e.g. 2,000–5,000 IU). */
  amountMax: z.number().nonnegative().optional(),
  unit: z.string(),
  /** Discrete units that make one full dose in this block (boron 3, creatine 2). */
  perServing: z.number().int().min(1).default(1),
});
export type Dose = z.infer<typeof Dose>;

export const Cycle = z.object({
  onDays: z.number().int().min(1),
  offDays: z.number().int().min(0),
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type Cycle = z.infer<typeof Cycle>;

export const Ceiling = z.object({ amount: z.number().positive(), unit: z.string(), note: z.string() });

export const Inventory = z.object({
  /** 0 means "not set up yet"; the app asks for it before showing days remaining. */
  unitsPerContainer: z.number().nonnegative().default(0),
  unitsPerDay: z.number().nonnegative().default(0),
  containersOnHand: z.number().nonnegative().default(0),
  lastRefillDate: z.string().nullable().default(null),
});
export type Inventory = z.infer<typeof Inventory>;

export const StackItem = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().optional(),
  form: z.string().optional(),
  dose: Dose,
  /** Free text shown on the card, e.g. "2 caps". Always user-editable. */
  doseText: z.string(),
  block: StackBlock,
  /** Set when this row is one unit of a parent item dosed several times a block. */
  splitOf: z.string().optional(),
  requirement: Requirement.default('any'),
  /** As-needed: never counts toward a block's required total or the streak. */
  optional: z.boolean().default(false),
  optionalTrigger: OptionalTrigger.optional(),
  cycle: Cycle.optional(),
  ceiling: Ceiling.optional(),
  notes: z.string().optional(),
  inventory: Inventory.optional(),
  /** Key into the generic ingredient dictionary (public reference facts only). */
  ingredientId: z.string().optional(),
  /** Display order inside its block. */
  order: z.number().int().default(0),
});
export type StackItem = z.infer<typeof StackItem>;

export const BlockRule = z.object({ block: StackBlock, label: z.string(), rule: z.string(), defaultTime: z.string() });
export type BlockRule = z.infer<typeof BlockRule>;

export const StackSeed = z.object({
  kind: z.literal('boundless-ops-stack-seed'),
  seedVersion: z.literal(1),
  title: z.string(),
  /** Rendered on the Notes card. */
  notes: z.array(z.object({ title: z.string(), text: z.string() })).default([]),
  blocks: z.array(BlockRule).length(4),
  items: z.array(StackItem).min(1),
});
export type StackSeed = z.infer<typeof StackSeed>;

export const StackLogSchema = z.object({
  id: z.number().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  itemId: z.string(),
  taken: z.boolean(),
  /** Units taken for multi-unit items; defaults to the full serving. */
  count: z.number().int().nonnegative().optional(),
  takenAt: z.string().optional(),
  skippedReason: z.string().optional(),
  /** True when logged on a cycle off day through the long-press override. */
  offDayOverride: z.boolean().optional(),
});
export type StackLogRow = z.infer<typeof StackLogSchema>;

export const LabUnits = z.object({
  totalT: z.string().default('ng/dL'),
  freeT: z.string().default('pg/mL'),
  shbg: z.string().default('nmol/L'),
  estradiol: z.string().default('pg/mL'),
  vitD25OH: z.enum(['ng/mL', 'nmol/L']).default('ng/mL'),
  ferritin: z.string().default('ng/mL'),
});
export type LabUnits = z.infer<typeof LabUnits>;

export const LabPanelSchema = z.object({
  id: z.number().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalT: z.number().nullable().default(null),
  freeT: z.number().nullable().default(null),
  shbg: z.number().nullable().default(null),
  estradiol: z.number().nullable().default(null),
  vitD25OH: z.number().nullable().default(null),
  ferritin: z.number().nullable().default(null),
  units: LabUnits.default(() => LabUnits.parse({})),
  lab: z.string().optional(),
  notes: z.string().optional(),
});
export type LabPanel = z.infer<typeof LabPanelSchema>;

export const LAB_MARKERS = [
  { key: 'totalT', label: 'Total testosterone', defaultUnit: 'ng/dL' },
  { key: 'freeT', label: 'Free testosterone', defaultUnit: 'pg/mL' },
  { key: 'shbg', label: 'SHBG', defaultUnit: 'nmol/L' },
  { key: 'estradiol', label: 'Estradiol', defaultUnit: 'pg/mL' },
  { key: 'vitD25OH', label: '25-OH-D', defaultUnit: 'ng/mL' },
  { key: 'ferritin', label: 'Ferritin', defaultUnit: 'ng/mL' },
] as const;
export type LabMarker = (typeof LAB_MARKERS)[number]['key'];

/** Quarterly panel. */
export const PANEL_INTERVAL_DAYS = 90;

export function parseSeed(text: string): { ok: true; data: StackSeed } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }
  const r = StackSeed.safeParse(json);
  if (!r.success) return { ok: false, error: 'Not a stack seed: ' + r.error.issues.slice(0, 3).map((i) => `${i.path.join('.')} ${i.message}`).join('; ') };
  const ids = new Set<string>();
  for (const it of r.data.items) {
    if (ids.has(it.id)) return { ok: false, error: `Duplicate item id: ${it.id}` };
    ids.add(it.id);
  }
  for (const it of r.data.items) {
    if (it.splitOf && !ids.has(it.splitOf)) return { ok: false, error: `Split ${it.id} points at a missing parent: ${it.splitOf}` };
    if (it.splitOf === it.id) return { ok: false, error: `Split ${it.id} points at itself` };
  }
  return { ok: true, data: r.data };
}
