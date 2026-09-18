import { describe, it, expect } from 'vitest';
import {
  cycleState, itemOnCycle, isRequiredOn, indexLogs, unitsTaken, blockProgress, dayComplete, streak,
  adherence, lastNDates, inventoryState, ceilingFlag, separationWarning, fastedConflict, nextPanelDue,
  vitDBand, vitDStatus, cycleCompliance, blockHeatmap,
} from '@/lib/stack';
import { parseSeed, type StackItem, type StackLogRow, type LabPanel } from '@/data/stackSchema';

const item = (over: Partial<StackItem> & { id: string }): StackItem => ({
  name: over.id, dose: { amount: 1, unit: 'cap', perServing: 1 }, doseText: '1 cap', block: 'midday',
  requirement: 'any', optional: false, order: 0, ...over,
});

const CYCLE = { onDays: 5, offDays: 2, anchorDate: '2026-09-21' };

describe('cycle math (Phoenix dates)', () => {
  it('maps anchor + N days onto the right on/off day', () => {
    expect(cycleState(CYCLE, '2026-09-21')).toEqual({ on: true, dayOfPhase: 1, phaseLength: 5 });
    expect(cycleState(CYCLE, '2026-09-25')).toEqual({ on: true, dayOfPhase: 5, phaseLength: 5 });
    expect(cycleState(CYCLE, '2026-09-26')).toEqual({ on: false, dayOfPhase: 1, phaseLength: 2 });
    expect(cycleState(CYCLE, '2026-09-27')).toEqual({ on: false, dayOfPhase: 2, phaseLength: 2 });
    expect(cycleState(CYCLE, '2026-09-28')).toEqual({ on: true, dayOfPhase: 1, phaseLength: 5 });
  });
  it('crosses month and year boundaries', () => {
    // 2026-09-21 + 10 days = 2026-10-01, which is day 4 of an on-phase
    expect(cycleState(CYCLE, '2026-10-01')).toEqual({ on: true, dayOfPhase: 4, phaseLength: 5 });
    expect(cycleState(CYCLE, '2026-11-01')).toEqual({ on: false, dayOfPhase: 2, phaseLength: 2 });
    expect(cycleState(CYCLE, '2027-01-01')).toEqual({ on: true, dayOfPhase: 5, phaseLength: 5 });
  });
  it('handles dates before the anchor', () => {
    expect(cycleState(CYCLE, '2026-09-20')).toEqual({ on: false, dayOfPhase: 2, phaseLength: 2 });
    expect(cycleState(CYCLE, '2026-09-14')).toEqual({ on: true, dayOfPhase: 1, phaseLength: 5 });
  });
  it('treats an item with no cycle as always on', () => {
    expect(itemOnCycle(item({ id: 'a' }), '2026-09-26')).toBe(true);
    expect(itemOnCycle(item({ id: 'q', cycle: CYCLE }), '2026-09-26')).toBe(false);
  });
});

describe('required vs optional vs off-cycle', () => {
  const required = item({ id: 'r' });
  const optional = item({ id: 'o', optional: true, optionalTrigger: 'some-days' });
  const cycled = item({ id: 'c', cycle: CYCLE });
  it('ignores optional items and off-day cycle items', () => {
    expect(isRequiredOn(required, '2026-09-26')).toBe(true);
    expect(isRequiredOn(optional, '2026-09-21')).toBe(false);
    expect(isRequiredOn(cycled, '2026-09-21')).toBe(true);
    expect(isRequiredOn(cycled, '2026-09-26')).toBe(false);
  });
  it('a day of only optional and off-cycle items is not "complete"', () => {
    expect(dayComplete([optional, cycled], indexLogs([]), '2026-09-26')).toBe(false);
  });
});

describe('block progress and partial counts', () => {
  const boron = item({ id: 'boron', dose: { amount: 2, unit: 'mg', perServing: 3 }, doseText: '2 mg × 3' });
  const sel = item({ id: 'sel' });
  const opt = item({ id: 'opt', optional: true, optionalTrigger: 'some-days' });
  const logs = indexLogs([
    { date: '2026-09-21', itemId: 'boron', taken: false, count: 2 },
    { date: '2026-09-21', itemId: 'opt', taken: true, count: 1 },
  ]);
  it('counts units, not rows, and leaves optional items out of the total', () => {
    const p = blockProgress([boron, sel, opt], logs, '2026-09-21', 'midday');
    expect(p.total).toBe(4);
    expect(p.done).toBe(2);
    expect(p.complete).toBe(false);
    expect(p.optional.map((i) => i.id)).toEqual(['opt']);
    expect(p.required.map((i) => i.id)).toEqual(['boron', 'sel']);
  });
  it('caps a count at the serving size and completes when every unit is in', () => {
    const full = indexLogs([
      { date: '2026-09-21', itemId: 'boron', taken: true, count: 9 },
      { date: '2026-09-21', itemId: 'sel', taken: true },
    ]);
    expect(unitsTaken(full.get('2026-09-21|boron'), boron)).toBe(3);
    expect(blockProgress([boron, sel], full, '2026-09-21', 'midday').complete).toBe(true);
    expect(dayComplete([boron, sel], full, '2026-09-21')).toBe(true);
  });
  it('separates off-cycle items into their own group', () => {
    const q = item({ id: 'q', block: 'wake', cycle: CYCLE });
    const p = blockProgress([q], indexLogs([]), '2026-09-26', 'wake');
    expect(p.offCycle.map((i) => i.id)).toEqual(['q']);
    expect(p.total).toBe(0);
  });
});

describe('streak', () => {
  const a = item({ id: 'a' });
  const full = (date: string): StackLogRow => ({ date, itemId: 'a', taken: true, count: 1 });
  it('counts back from today and lets an unfinished today pass', () => {
    const logs = indexLogs(['2026-09-19', '2026-09-20', '2026-09-21'].map(full));
    expect(streak([a], logs, '2026-09-21')).toBe(3);
    // today not logged yet: the run up to yesterday still stands
    expect(streak([a], logs, '2026-09-22')).toBe(3);
    // a full missed day breaks it
    expect(streak([a], logs, '2026-09-23')).toBe(0);
  });
  it('is zero with no items', () => {
    expect(streak([], indexLogs([]), '2026-09-21')).toBe(0);
  });
  it('ignores optional items when deciding a day is complete', () => {
    const opt = item({ id: 'o', optional: true, optionalTrigger: 'some-days' });
    const logs = indexLogs([full('2026-09-21')]);
    expect(streak([a, opt], logs, '2026-09-21')).toBe(1);
  });
});

describe('adherence', () => {
  const boron = item({ id: 'boron', dose: { amount: 2, unit: 'mg', perServing: 3 }, doseText: '2 mg × 3' });
  it('reports partial counts as a fraction (2 of 3 = 0.67)', () => {
    const logs = indexLogs([{ date: '2026-09-21', itemId: 'boron', taken: false, count: 2 }]);
    const [r] = adherence([boron], logs, ['2026-09-21']);
    expect(r!.taken).toBe(2);
    expect(r!.required).toBe(3);
    expect(Number(r!.pct!.toFixed(2))).toBe(0.67);
  });
  it('skips days the item was not required', () => {
    const q = item({ id: 'q', cycle: CYCLE });
    const dates = ['2026-09-25', '2026-09-26', '2026-09-27'];
    const [r] = adherence([q], indexLogs([{ date: '2026-09-25', itemId: 'q', taken: true, count: 1 }]), dates);
    expect(r!.required).toBe(1);
    expect(r!.pct).toBe(1);
  });
  it('builds date ranges and a per-block heatmap', () => {
    expect(lastNDates('2026-09-21', 3)).toEqual(['2026-09-19', '2026-09-20', '2026-09-21']);
    const rows = blockHeatmap([boron], indexLogs([]), ['2026-09-21']);
    expect(rows[0]!.blocks).toEqual([-1, -1, 0, -1]);
  });
  it('compares a cycled item against its schedule', () => {
    const q = item({ id: 'q', cycle: CYCLE });
    const rows = cycleCompliance(q, indexLogs([{ date: '2026-09-26', itemId: 'q', taken: true, count: 1 }]), ['2026-09-25', '2026-09-26']);
    expect(rows).toEqual([
      { date: '2026-09-25', scheduledOn: true, took: false },
      { date: '2026-09-26', scheduledOn: false, took: true },
    ]);
  });
});

describe('inventory', () => {
  const withInv = (over: Partial<NonNullable<StackItem['inventory']>>) =>
    item({ id: 'i', inventory: { unitsPerContainer: 60, unitsPerDay: 2, containersOnHand: 1, lastRefillDate: null, ...over } });
  it('computes days remaining and threshold levels', () => {
    expect(inventoryState(withInv({}))).toEqual({ daysRemaining: 30, level: 'ok' });
    expect(inventoryState(withInv({ unitsPerContainer: 28 }))).toEqual({ daysRemaining: 14, level: 'amber' });
    expect(inventoryState(withInv({ unitsPerContainer: 30 }))).toEqual({ daysRemaining: 15, level: 'ok' });
    expect(inventoryState(withInv({ unitsPerContainer: 10 }))).toEqual({ daysRemaining: 5, level: 'red' });
    expect(inventoryState(withInv({ containersOnHand: 0 }))).toEqual({ daysRemaining: 0, level: 'red' });
    expect(inventoryState(withInv({ containersOnHand: 2 }))).toEqual({ daysRemaining: 60, level: 'ok' });
  });
  it('is null until the container size is set, or with no inventory at all', () => {
    expect(inventoryState(withInv({ unitsPerContainer: 0 }))).toBeNull();
    expect(inventoryState(withInv({ unitsPerDay: 0 }))).toBeNull();
    expect(inventoryState(item({ id: 'x' }))).toBeNull();
  });
});

describe('display-only rules', () => {
  it('flags a dose at or past half the ceiling and stays quiet below it', () => {
    const sel = item({ id: 's', dose: { amount: 200, unit: 'mcg', perServing: 1 }, ceiling: { amount: 400, unit: 'mcg', note: 'ceiling note' } });
    expect(ceilingFlag(sel)).toBe('ceiling note');
    const low = item({ id: 's2', dose: { amount: 100, unit: 'mcg', perServing: 1 }, ceiling: { amount: 400, unit: 'mcg', note: 'n' } });
    expect(ceilingFlag(low)).toBeNull();
    // a range is judged on its top end
    const ranged = item({ id: 's3', dose: { amount: 100, amountMax: 250, unit: 'mcg', perServing: 1 }, ceiling: { amount: 400, unit: 'mcg', note: 'n' } });
    expect(ceilingFlag(ranged)).toBe('n');
    expect(ceilingFlag(item({ id: 'none' }))).toBeNull();
  });
  it('warns when an empty-stomach item follows a with-food item inside 30 min', () => {
    const empty = item({ id: 'q', name: 'Qualia', requirement: 'empty-stomach' });
    const food = item({ id: 'f', name: 'Fish oil', requirement: 'with-food' });
    const logs: StackLogRow[] = [{ date: '2026-09-21', itemId: 'f', taken: true, takenAt: '2026-09-21T14:00:00Z' }];
    expect(separationWarning(empty, [empty, food], logs, '2026-09-21T14:10:00Z')).toContain('Fish oil');
    expect(separationWarning(empty, [empty, food], logs, '2026-09-21T14:45:00Z')).toBeNull();
    // and never for a with-food item itself
    expect(separationWarning(food, [empty, food], logs, '2026-09-21T14:10:00Z')).toBeNull();
  });
  it('notes a with-food item taken before the fasted session is logged', () => {
    const food = item({ id: 'f', requirement: 'with-food' });
    expect(fastedConflict(food, true, false)).toContain('Fasted session');
    expect(fastedConflict(food, true, true)).toBeNull();
    expect(fastedConflict(food, false, false)).toBeNull();
    expect(fastedConflict(item({ id: 'a', requirement: 'any' }), true, false)).toBeNull();
  });
});

describe('labs', () => {
  const panel = (date: string): LabPanel => ({ date, totalT: 600, freeT: 15, shbg: 30, estradiol: 25, vitD25OH: 50, ferritin: 90, units: { totalT: 'ng/dL', freeT: 'pg/mL', shbg: 'nmol/L', estradiol: 'pg/mL', vitD25OH: 'ng/mL', ferritin: 'ng/mL' } });
  it('computes the next panel from the last entry plus 90 days', () => {
    const due = nextPanelDue([panel('2026-06-01'), panel('2026-09-01')], '2026-09-21')!;
    expect(due.last).toBe('2026-09-01');
    expect(due.due).toBe('2026-11-30');
    expect(due.daysUntil).toBe(70);
    expect(due.overdue).toBe(false);
    expect(nextPanelDue([panel('2026-06-01')], '2026-09-21')!.overdue).toBe(true);
    expect(nextPanelDue([], '2026-09-21')).toBeNull();
  });
  it('draws the 25-OH-D band in the recorded unit', () => {
    expect(vitDBand('ng/mL')).toEqual({ low: 40, high: 60 });
    expect(vitDStatus(50, 'ng/mL')).toBe('in band');
    expect(vitDStatus(30, 'ng/mL')).toBe('below');
    expect(vitDStatus(70, 'ng/mL')).toBe('above');
    expect(vitDStatus(125, 'nmol/L')).toBe('in band');
    expect(vitDStatus(80, 'nmol/L')).toBe('below');
  });
});

describe('seed validation', () => {
  const base = {
    kind: 'boundless-ops-stack-seed', seedVersion: 1, title: 'T',
    blocks: [
      { block: 'wake', label: '01', rule: 'r', defaultTime: '06:30' },
      { block: 'breakfast', label: '02', rule: 'r', defaultTime: '07:30' },
      { block: 'midday', label: '03', rule: 'r', defaultTime: '12:30' },
      { block: 'bedtime', label: '04', rule: 'r', defaultTime: '21:30' },
    ],
    items: [{ id: 'a', name: 'A', dose: { amount: 1, unit: 'cap' }, doseText: '1 cap', block: 'wake' }],
  };
  it('accepts a well-formed seed and applies defaults', () => {
    const r = parseSeed(JSON.stringify(base));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.items[0]!.dose.perServing).toBe(1);
      expect(r.data.items[0]!.optional).toBe(false);
      expect(r.data.items[0]!.requirement).toBe('any');
    }
  });
  it('rejects bad JSON, the wrong kind, duplicate ids, and dangling splits', () => {
    expect(parseSeed('nope').ok).toBe(false);
    expect(parseSeed(JSON.stringify({ ...base, kind: 'other' })).ok).toBe(false);
    const dup = parseSeed(JSON.stringify({ ...base, items: [...base.items, { ...base.items[0] }] }));
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toContain('Duplicate item id');
    const split = parseSeed(JSON.stringify({ ...base, items: [{ ...base.items[0], splitOf: 'ghost' }] }));
    expect(split.ok).toBe(false);
    if (!split.ok) expect(split.error).toContain('missing parent');
  });
  it('resolves a split that points at a real parent', () => {
    const r = parseSeed(JSON.stringify({ ...base, items: [base.items[0], { id: 'a2', name: 'A unit 2', dose: { amount: 1, unit: 'cap' }, doseText: '1 cap', block: 'wake', splitOf: 'a' }] }));
    expect(r.ok).toBe(true);
  });
});
