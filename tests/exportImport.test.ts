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
    await Promise.all([d.blocks.clear(), d.logs.clear(), d.habits.clear(), d.vitals.clear(), d.kv.clear()]);
    expect(await recordCounts(d)).toEqual({ blocks: 0, logs: 0, habits: 0, vitals: 0 });

    const parsed = parseImport(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await applyImport(parsed.data, 'replace', d);
    const after = await buildExport(d);
    expect(normalizeForCompare(after)).toEqual(normalizeForCompare(before));
    expect(after.settings?.age).toBe(34);
    expect(await recordCounts(d)).toEqual({ blocks: 1, logs: 2, habits: 2, vitals: 1 });
  });

  it('merge upserts without duplicating', async () => {
    const d = new BoundlessDB('test-merge');
    await seed(d);
    const snap = await buildExport(d);
    await applyImport(snap, 'merge', d);
    expect(await recordCounts(d)).toEqual({ blocks: 1, logs: 2, habits: 2, vitals: 1 });
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

  it('names the file by date', () => {
    expect(exportFilename(new Date('2026-09-16T20:00:00Z'))).toBe('boundless-ops-backup-2026-09-16.json');
  });
});
