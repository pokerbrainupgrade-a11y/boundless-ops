/** Seeded fake data for Intel and AAR tests. */
export function demoExport(startDate = '2026-09-21') {
  const b1 = 1, b2 = 2;
  const log = (blockId: number, dayN: number, sessionId: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    blockId, dayN, week: Math.ceil(dayN / 7), day: ((dayN - 1) % 7) + 1, slot: 'main' as const, sessionId,
    startedAt: new Date(Date.UTC(2026, 8, 20 + dayN, 14, 0)).toISOString(), endedAt: new Date(Date.UTC(2026, 8, 20 + dayN, 14, 30)).toISOString(),
    completed: true, data, ...extra,
  });
  const tab = (t: number) => ({ rounds: [t, t, t - 1, t - 1, t - 2, t - 2, t - 3, t - 3], total: 8 * t - 12, dropoff: Math.round((3 / t) * 100), movement: 'bike', unit: 'cals' });
  const logs = [
    log(b1, 1, 'A', tab(12)), log(b1, 3, 'A', tab(13)), log(b1, 5, 'A', tab(13)),
    log(b1, 8, 'A', tab(14)), log(b1, 10, 'A', tab(14)), log(b1, 12, 'A', tab(15)),
    log(b1, 4, 'F', { lifts: [{ pattern: 'upperPush', exercise: 'Chest press', load: 60, seconds: 110, reps: 3 }, { pattern: 'upperPull', exercise: 'Row', load: 50, seconds: 120, reps: 3 }, { pattern: 'lowerPush', exercise: 'Leg press', load: 120, seconds: 130, reps: 3 }, { pattern: 'lowerPull', exercise: 'RDL', load: 70, seconds: 100, reps: 2 }] }),
    log(b1, 11, 'F', { lifts: [{ pattern: 'upperPush', exercise: 'Chest press', load: 65, seconds: 120, reps: 3 }, { pattern: 'upperPull', exercise: 'Row', load: 55, seconds: 125, reps: 3 }, { pattern: 'lowerPush', exercise: 'Leg press', load: 130, seconds: 125, reps: 3 }, { pattern: 'lowerPull', exercise: 'RDL', load: 75, seconds: 110, reps: 3 }] }),
    log(b1, 13, 'H', { rounds: [150, 158, 161, 163, 165] }, { hr: { avg: 155, max: 172 } }),
    log(b1, 5, 'I', { minutes: 22 }), log(b1, 12, 'I', { minutes: 30 }),
    log(b1, 14, 'L', { durationMin: 130, avgHr: 128, distance: '9 mi', fuel: 'electrolytes' }),
    log(b1, 6, 'coldImmersion', { minutes: 3, waterF: 52 }), log(b1, 13, 'coldImmersion', { minutes: 4, waterF: 50 }),
    ...[1, 2, 3, 5, 8, 9, 10, 12].map((d) => ({ ...log(b1, d, 'coldShower', { done: true }), slot: 'am' as const })),
    // block 2 partial
    log(b2, 1, 'A', tab(15)), log(b2, 3, 'A', tab(16)),
    log(b2, 4, 'F', { lifts: [{ pattern: 'upperPush', exercise: 'Chest press', load: 70, seconds: 125, reps: 3 }, { pattern: 'upperPull', exercise: 'Row', load: 60, seconds: 120, reps: 3 }, { pattern: 'lowerPush', exercise: 'Leg press', load: 140, seconds: 120, reps: 3 }, { pattern: 'lowerPull', exercise: 'RDL', load: 80, seconds: 115, reps: 3 }] }),
  ];
  return {
    app: 'boundless-ops' as const,
    schemaVersion: 1 as const,
    exportedAt: '2026-10-20T00:00:00.000Z',
    blocks: [
      { id: b1, n: 1, startDate, shift: 0, createdAt: '2026-09-20T00:00:00.000Z', endedAt: '2026-10-05T00:00:00.000Z' },
      { id: b2, n: 2, startDate: '2026-10-12', shift: 0, createdAt: '2026-10-11T00:00:00.000Z' },
    ],
    logs,
    habits: [{ blockId: b1, date: startDate, habitId: 'breathWake', done: true }],
    vitals: Array.from({ length: 14 }, (_, i) => ({ date: `2026-09-${String(21 + i).padStart(2, '0')}`, restingHr: 58 - (i % 4), hrv: 60 + (i % 5) * 2 })),
  };
}
