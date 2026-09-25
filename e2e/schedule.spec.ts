import { test, expect } from '@playwright/test';
import { setup } from './helpers';

type Hook = {
  setCurrentDay: (n: number) => Promise<void>;
  completeDay: (n: number) => Promise<void>;
  saveLog: (l: object) => Promise<number>;
  db: { blocks: { toArray(): Promise<{ id: number; currentDay?: number }[]> }; logs: { count(): Promise<number> } };
};

test.describe('completion-gated day progress', () => {
  test('Today waits for the previous day; Complete All logs the rest and moves on; the block ends after Day 42', async ({ page }) => {
    await setup(page, { age: 34 }, '2026-09-21', '2026-09-21T20:00:00Z');
    await page.goto('/boundless-ops/#/today');
    await expect(page.getByTestId('day-chip')).toHaveText('Day 01');
    await expect(page.getByTestId('load-chip')).toHaveText('High');
    await expect(page.getByTestId('day-progress')).toHaveText('0/4 done');
    await expect(page.getByTestId('complete-all')).toHaveText('COMPLETE ALL');

    // three calendar days pass with nothing logged: still Day 01
    await page.clock.setSystemTime(new Date('2026-09-24T20:00:00Z'));
    await page.reload();
    await expect(page.getByTestId('day-chip')).toHaveText('Day 01');
    await expect(page.getByTestId('card-am').getByTestId('session-row').first()).toHaveAttribute('data-done', 'false');

    // Complete All: every required session on Day 01 gets a completed log, Today is on Day 02
    await page.getByTestId('complete-all').click();
    await expect(page.getByTestId('day-chip')).toHaveText('Day 02');
    await expect(page.getByTestId('load-chip')).toHaveText('Moderate');
    await expect(page.getByTestId('day-progress')).toHaveText('0/4 done');
    expect(await page.evaluate(() => (window as unknown as { __bops: Hook }).__bops.db.logs.count())).toBe(4);
    await page.goto('/boundless-ops/#/schedule');
    await expect(page.getByTestId('day-1')).toHaveAttribute('data-state', 'done');
    await expect(page.getByTestId('day-1')).toContainText('4 logged');
    await expect(page.getByTestId('day-1')).toContainText('Sep 24');
    await expect(page.getByTestId('day-2')).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('day-3')).toHaveAttribute('data-state', 'upcoming');
    await expect(page.getByText('on Day 02')).toBeVisible();

    // logging the last required session by hand also advances; optional sessions never hold the day
    await page.goto('/boundless-ops/#/today');
    const logDay2 = (sessionId: string, slot: string, variant?: string) => page.evaluate(async ({ sessionId, slot, variant }) => {
      const h = (window as unknown as { __bops: Hook }).__bops;
      const b = (await h.db.blocks.toArray())[0]!;
      const now = new Date().toISOString();
      await h.saveLog({ blockId: b.id, dayN: 2, week: 1, day: 2, slot, sessionId, variant, startedAt: now, endedAt: now, completed: true, data: {} });
    }, { sessionId, slot, variant });
    await logDay2('fastedCardio', 'am');
    await expect(page.getByTestId('day-chip')).toHaveText('Day 02');
    await expect(page.getByTestId('day-progress')).toHaveText('1/4 done');
    await logDay2('coldShower', 'am');
    await logDay2('B', 'main', 'seqB');
    await expect(page.getByTestId('day-progress')).toHaveText('3/4 done');
    // optional D is left alone; logging C, the last required one, moves Today on
    await logDay2('C', 'main');
    await expect(page.getByTestId('day-chip')).toHaveText('Day 03');

    // the AAR shows the bulk-logged sessions
    await page.goto('/boundless-ops/#/aar');
    await expect(page.getByText('Day 01')).toBeVisible();

    // jump to the last day, finish it, and the block is complete
    await page.evaluate(() => (window as unknown as { __bops: Hook }).__bops.setCurrentDay(42));
    await page.goto('/boundless-ops/#/today');
    await expect(page.getByTestId('day-chip')).toHaveText('Day 42');
    await expect(page.getByText('Week 6 / 6')).toBeVisible();
    await page.getByTestId('complete-all').click();
    await expect(page.getByText('Operation Block 01 complete')).toBeVisible();
    await page.getByTestId('start-date-input').fill('2026-11-09');
    await page.getByTestId('start-block').click();
    await expect(page.getByText('Operation Block 02 starts')).toBeVisible();
    await page.clock.setSystemTime(new Date('2026-11-09T20:00:00Z'));
    await page.reload();
    await expect(page.getByTestId('day-chip')).toHaveText('Day 01');
    await expect(page.getByText('Operation Block 02')).toBeVisible();
  });

  test('a block from before the gate picks up at its first incomplete day; the Schedule can set the current day', async ({ page }) => {
    await setup(page, {}, '2026-09-21', '2026-09-30T20:00:00Z');
    // simulate an older install: no currentDay, day 1 complete, day 2 skipped, day 3 complete
    await page.evaluate(async () => {
      const h = (window as unknown as { __bops: { db: { blocks: { toArray(): Promise<{ id: number }[]>; update(id: number, p: object): Promise<number> }; logs: { bulkAdd(rows: object[]): Promise<unknown> } }; reloadBlocks: () => Promise<void>; reloadLogs: () => Promise<void> } }).__bops;
      const b = (await h.db.blocks.toArray())[0]!;
      const now = '2026-09-22T14:00:00Z';
      const l = (dayN: number, sessionId: string, slot: string, variant?: string) => ({ blockId: b.id, dayN, week: 1, day: dayN, slot, sessionId, variant, startedAt: now, endedAt: now, completed: true, data: {} });
      await h.db.logs.bulkAdd([l(1, 'lightMovement', 'am'), l(1, 'coldShower', 'am'), l(1, 'B', 'main', 'seqA'), l(1, 'A', 'main', 'bike'), l(3, 'lightMovement', 'am'), l(3, 'coldShower', 'am'), l(3, 'B', 'main', 'seqA'), l(3, 'E', 'main'), l(3, 'A', 'main', 'kbSwings')]);
      await h.db.blocks.update(b.id, { currentDay: undefined });
      await h.reloadBlocks();
      await h.reloadLogs();
    });
    await page.goto('/boundless-ops/#/today');
    await expect(page.getByTestId('day-chip')).toHaveText('Day 02');
    await page.goto('/boundless-ops/#/schedule');
    await expect(page.getByTestId('day-3')).toContainText('5 logged');
    await page.getByTestId('jump-day-input').fill('5');
    await page.getByTestId('jump-day-btn').click();
    await expect(page.getByText('on Day 05')).toBeVisible();
    await page.goto('/boundless-ops/#/today');
    await expect(page.getByTestId('day-chip')).toHaveText('Day 05');
  });

  test('a future start date still counts down to Day 01', async ({ page }) => {
    await setup(page, {}, '2026-09-28', '2026-09-25T20:00:00Z');
    await page.goto('/boundless-ops/#/today');
    await expect(page.getByText('Operation Block 01 starts')).toBeVisible();
    await expect(page.getByText('3 days to go')).toBeVisible();
    await page.clock.setSystemTime(new Date('2026-09-28T20:00:00Z'));
    await page.reload();
    await expect(page.getByTestId('day-chip')).toHaveText('Day 01');
  });

  test('schedule grid previews a day and the start date can be edited', async ({ page }) => {
    await setup(page, {}, '2026-09-21');
    await page.goto('/boundless-ops/#/schedule');
    await expect(page.getByTestId('day-13')).toContainText('H');
    await expect(page.getByTestId('week-6')).toBeVisible();
    await expect(page.getByTestId('day-42')).toContainText('L');
    await expect(page.getByTestId('day-20')).toContainText('G');
    await page.getByTestId('day-13').click();
    await expect(page.getByTestId('day-preview')).toContainText('5x4 VO2 max');
    // tap a session in the preview → brief with a Start button → the timer
    await page.getByTestId('day-preview').getByTestId('view-session').filter({ hasText: '5x4' }).click();
    await expect(page.getByTestId('session-detail')).toBeVisible();
    await expect(page.getByTestId('session-brief')).toContainText('87 to 97%');
    await page.getByTestId('brief-start').click();
    await expect(page.getByTestId('timer')).toHaveAttribute('data-segments', '11');
    await page.goto('/boundless-ops/#/schedule');
    await page.getByTestId('day-13').click();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Edit start date' }).click();
    await page.getByTestId('edit-start-input').fill('2026-09-28');
    await page.getByTestId('edit-start-save').click();
    await expect(page.getByText('starts 2026-09-28')).toBeVisible();
  });
});
