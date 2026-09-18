import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { BoundlessDB, recordCounts } from '@/lib/db';
import { buildExport, parseImport, applyImport, normalizeForCompare, exportFilename } from '@/lib/exportImport';

async function seed(d: BoundlessDB) {
  const blockId = (await d.blocks.add({ n: 1, startDate: '2026-09-21', shift: 0, createdAt: '2026-09-20T12:00:00Z' })) as number;
  await d.logs.bulkAdd([
    { blockId, dayN: 1, week: 1, day: 1, slot: 'main', sessionId: 'A', variant: 'bike', startedAt: '2026-09-21T14:00:00Z', endedAt: '2026-09-21T14:05:00Z', rpe: 7, completed: true, data: { rounds: [12, 12, 11, 11, 10, 10, 9, 9], total: 84, dropoff: 25 } },
    { blockId, dayN: 4, week: 1, day: 4, slot: 'main', sessionId: 'F', startedAt: '2026-09-24T14:00:00Z', endedAt: '2026-09-24T14:25:00Z', completed: true, hr: { avg: 120, max: 150 }, data: { lifts: [{ pattern: 'upperPush', load: 60, seconds: 110, reps: 3 }] } },
  ]);
  await d.habits.bulkAdd([
    { blockId, date: '2026-09-21', habitId: 'breathWake', done: true },
    { blockId, date: '2026-09-21', habitId: 'postMealWalk', done: true },
  ]);
  await d.vitals.bulkAdd([{ date: '2026-09-21', restingHr: 58, hrv: 62 }]);
  await d.stackItems.bulkAdd([
    { id: 'item-a', name: 'Item A', dose: { amount: 1, unit: 'cap', perServing: 1 }, doseText: '1 cap', block: 'wake', requirement: 'empty-stomach', optional: false, order: 1, cycle: { onDays: 5, offDays: 2, anchorDate: '2026-09-21' } },
    { id: 'item-b', name: 'Item B', dose: { amount: 2, unit: 'mg', perServing: 3 }, doseText: '2 mg × 3', block: 'midday', requirement: 'with-food', optional: false, order: 1, ceiling: { amount: 400, unit: 'mg', note: 'ceiling' } },
  ]);
  await d.stackLogs.bulkAdd([
    { date: '2026-09-21', itemId: 'item-a', taken: true, count: 1, takenAt: '2026-09-21T13:30:00Z' },
    { date: '2026-09-21', itemId: 'item-b', taken: false, count: 2, takenAt: '2026-09-21T19:00:00Z' },
  ]);
  await d.labs.bulkAdd([{ date: '2026-09-01', totalT: 610, freeT: 14.2, shbg: 31, estradiol: 24, vitD25OH: 48, ferritin: 95, units: { totalT: 'ng/dL', freeT: 'pg/mL', shbg: 'nmol/L', estradiol: 'pg/mL', vitD25OH: 'ng/mL', ferritin: 'ng/mL' }, lab: 'Quest' }]);
  await d.kv.put({ key: 'settings', value: { callsign: 'x', age: 34 } });
}

describe('export → wipe → import round-trip', () => {
  it('restores identical records with replace', async () => {
    const d = new BoundlessDB('test-roundtrip');
    await seed(d);
    const before = await buildExport(d);
    expect(before.logs.length).toBe(2);
    const text = JSON.stringify(before);

    // wipe
    await Promise.all([d.blocks.clear(), d.logs.clear(), d.habits.clear(), d.vitals.clear(), d.stackItems.clear(), d.stackLogs.clear(), d.labs.clear(), d.kv.clear()]);
    expect(await recordCounts(d)).toEqual({ blocks: 0, logs: 0, habits: 0, vitals: 0, stackItems: 0, stackLogs: 0, labs: 0 });

    const parsed = parseImport(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await applyImport(parsed.data, 'replace', d);
    const after = await buildExport(d);
    expect(normalizeForCompare(after)).toEqual(normalizeForCompare(before));
    expect(after.settings?.age).toBe(34);
    expect(after.stackItems.length).toBe(2);
    expect(after.stackLogs.find((l) => l.itemId === 'item-b')?.count).toBe(2);
    expect(after.labs[0]?.vitD25OH).toBe(48);
    expect(await recordCounts(d)).toEqual({ blocks: 1, logs: 2, habits: 2, vitals: 1, stackItems: 2, stackLogs: 2, labs: 1 });
  });

  it('merge upserts without duplicating', async () => {
    const d = new BoundlessDB('test-merge');
    await seed(d);
    const snap = await buildExport(d);
    await applyImport(snap, 'merge', d);
    expect(await recordCounts(d)).toEqual({ blocks: 1, logs: 2, habits: 2, vitals: 1, stackItems: 2, stackLogs: 2, labs: 1 });
    // a new record in the file gets added
    snap.logs.push({ ...snap.logs[0]!, id: 999, dayN: 3, day: 3 });
    await applyImport(snap, 'merge', d);
    expect((await recordCounts(d)).logs).toBe(3);
  });

  it('rejects invalid files', () => {
    expect(parseImport('not json').ok).toBe(false);
    expect(parseImport('{"app":"other"}').ok).toBe(false);
    const r = parseImport(JSON.stringify({ app: 'boundless-ops', schemaVersion: 1, exportedAt: 'x', blocks: [], logs: [{ bad: true }], habits: [], vitals: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Not a BOUNDLESS OPS backup');
  });

  it('imports a version 1 backup that predates the stack module', async () => {
    const d = new BoundlessDB('test-v1');
    const v1 = { app: 'boundless-ops', schemaVersion: 1, exportedAt: '2026-09-16T00:00:00.000Z', blocks: [], logs: [], habits: [], vitals: [] };
    const r = parseImport(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.stackItems).toEqual([]);
    await applyImport(r.data, 'replace', d);
    expect((await recordCounts(d)).stackItems).toBe(0);
    // and a raw version 1 object that never went through the parser
    await applyImport(v1 as unknown as typeof r.data, 'replace', d);
    expect((await recordCounts(d)).stackItems).toBe(0);
  });

  it('names the file by date', () => {
    expect(exportFilename(new Date('2026-09-16T20:00:00Z'))).toBe('boundless-ops-backup-2026-09-16.json');
  });
});
