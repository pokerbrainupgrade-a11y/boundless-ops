import { test, expect, type Page } from '@playwright/test';
import { setup } from './helpers';

type Hook = { setCurrentDay: (n: number) => Promise<void> };

/** Start a block on Day 01 and, if asked, jump Today to day n without logging anything. */
async function onDay(page: Page, n = 1) {
  await setup(page, {}, '2026-09-21');
  if (n > 1) await page.evaluate((d) => (window as unknown as { __bops: Hook }).__bops.setCurrentDay(d), n);
  await page.goto('/boundless-ops/#/today');
  await expect(page.getByTestId('day-chip')).toHaveText(`Day ${String(n).padStart(2, '0')}`);
}

test.describe('celebrations', () => {
  test('day complete: the card overlay appears over Day Progress with the copy, then auto-dismisses', async ({ page }) => {
    await onDay(page, 1);
    await expect(page.getByTestId('celebration-day')).toHaveCount(0);
    await page.getByTestId('complete-all').click();
    const card = page.getByTestId('celebration-day');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-static', 'false');
    await expect(page.getByTestId('complete-all-card')).toHaveClass(/celebrating/);
    await expect(page.getByTestId('celebration-headline')).toContainText('Day 01');
    await expect(page.getByTestId('celebration-stat')).toContainText('4/4 sessions');
    await expect(page.getByTestId('celebration-stat')).toContainText('min this week');
    // never a milestone on an ordinary day
    await expect(page.getByTestId('celebration-milestone')).toHaveCount(0);
    // gone on its own within the 1.5 s window, and Today has moved on
    await expect(card).toHaveCount(0, { timeout: 4000 });
    await expect(page.getByTestId('day-chip')).toHaveText('Day 02');
    await expect(page.getByTestId('complete-all-card')).not.toHaveClass(/celebrating/);
  });

  test('a tap dismisses the day card early', async ({ page }) => {
    await onDay(page, 2);
    await page.getByTestId('complete-all').click();
    const card = page.getByTestId('celebration-day');
    await expect(card).toBeVisible();
    await card.click();
    await expect(card).toHaveCount(0, { timeout: 500 });
  });

  test('milestone takeover on Day 7: week recap with confetti, auto-dismissed after about 3 s', async ({ page }) => {
    await onDay(page, 7);
    await page.getByTestId('complete-all').click();
    const take = page.getByTestId('celebration-milestone');
    await expect(take).toBeVisible();
    await expect(take).toHaveAttribute('data-kind', 'week');
    await expect(take).toHaveAttribute('data-static', 'false');
    await expect(take.locator('canvas.celebrate-confetti')).toHaveCount(1);
    await expect(take).toContainText('WEEK 1 COMPLETE');
    await expect(page.getByTestId('celebration-stat')).toContainText('sessions');
    await expect(page.getByTestId('celebration-stat')).toContainText('consistency');
    await expect(take).toContainText('Days 01–07');
    // the day tier never fires alongside a milestone
    await expect(page.getByTestId('celebration-day')).toHaveCount(0);
    // still up after 2 s, gone by 4 s
    await page.waitForTimeout(2000);
    await expect(take).toBeVisible();
    await expect(take).toHaveCount(0, { timeout: 2500 });
    await expect(page.getByTestId('day-chip')).toHaveText('Day 08');
  });

  test('milestone takeover on Day 42: block complete outranks the week end', async ({ page }) => {
    await onDay(page, 42);
    await page.getByTestId('complete-all').click();
    const take = page.getByTestId('celebration-milestone');
    await expect(take).toBeVisible();
    await expect(take).toHaveAttribute('data-kind', 'block');
    await expect(take).toContainText('BLOCK COMPLETE');
    await expect(take).toContainText('Days 01–42');
    await expect(page.getByTestId('celebration-day')).toHaveCount(0);
    await expect(take).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByText('Operation Block 01 complete')).toBeVisible();
  });

  test('halfway (Day 21) outranks the week end', async ({ page }) => {
    await onDay(page, 21);
    await page.getByTestId('complete-all').click();
    const take = page.getByTestId('celebration-milestone');
    await expect(take).toHaveAttribute('data-kind', 'halfway');
    await expect(take).toContainText('HALFWAY');
  });

  test('Set current day never celebrates, and finishing a day by hand does', async ({ page }) => {
    await onDay(page, 1);
    // jump to a milestone day: nothing fires
    await page.evaluate(() => (window as unknown as { __bops: Hook }).__bops.setCurrentDay(14));
    await expect(page.getByTestId('day-chip')).toHaveText('Day 14');
    await page.waitForTimeout(400);
    await expect(page.getByTestId('celebration-milestone')).toHaveCount(0);
    await expect(page.getByTestId('celebration-day')).toHaveCount(0);
    // back to Day 01 and log the last required session through the normal log path
    await page.evaluate(() => (window as unknown as { __bops: Hook }).__bops.setCurrentDay(1));
    await expect(page.getByTestId('day-chip')).toHaveText('Day 01');
    await page.evaluate(async () => {
      const h = (window as unknown as { __bops: { db: { blocks: { toArray(): Promise<{ id: number }[]> } }; saveLog: (l: object) => Promise<number> } }).__bops;
      const b = (await h.db.blocks.toArray())[0]!;
      const l = (sessionId: string, slot: string, variant?: string) => ({ blockId: b.id, dayN: 1, week: 1, day: 1, slot, sessionId, variant, startedAt: '2026-09-21T14:00:00Z', endedAt: '2026-09-21T14:25:00Z', completed: true, data: {} });
      await h.saveLog(l('lightMovement', 'am'));
      await h.saveLog(l('coldShower', 'am'));
      await h.saveLog(l('B', 'main', 'seqA'));
    });
    await expect(page.getByTestId('celebration-day')).toHaveCount(0);
    await page.evaluate(async () => {
      const h = (window as unknown as { __bops: { db: { blocks: { toArray(): Promise<{ id: number }[]> } }; saveLog: (l: object) => Promise<number> } }).__bops;
      const b = (await h.db.blocks.toArray())[0]!;
      await h.saveLog({ blockId: b.id, dayN: 1, week: 1, day: 1, slot: 'main', sessionId: 'A', variant: 'bike', startedAt: '2026-09-21T15:00:00Z', endedAt: '2026-09-21T15:25:00Z', completed: true, data: {} });
    });
    await expect(page.getByTestId('celebration-day')).toBeVisible();
    await expect(page.getByTestId('celebration-stat')).toContainText('4/4 sessions · 100 min this week');
    await expect(page.getByTestId('day-chip')).toHaveText('Day 02');
  });

  test('reduced motion: a static card and a static takeover, no confetti canvas', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await onDay(page, 1);
    await page.getByTestId('complete-all').click();
    const card = page.getByTestId('celebration-day');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-static', 'true');
    await expect(card).toHaveClass(/still/);
    await expect(page.getByTestId('celebration-headline')).toContainText('Day 01');
    await expect(page.getByTestId('celebration-stat')).toContainText('4/4 sessions');
    await expect(card).toHaveCount(0, { timeout: 4000 });

    await page.evaluate(() => (window as unknown as { __bops: Hook }).__bops.setCurrentDay(7));
    await expect(page.getByTestId('day-chip')).toHaveText('Day 07');
    await page.getByTestId('complete-all').click();
    const take = page.getByTestId('celebration-milestone');
    await expect(take).toBeVisible();
    await expect(take).toHaveAttribute('data-static', 'true');
    await expect(take.locator('canvas')).toHaveCount(0);
    await expect(take).toContainText('WEEK 1 COMPLETE');
    await expect(take).toHaveCount(0, { timeout: 5000 });
  });

  test('the Celebration sound toggle lives in Kit and defaults on', async ({ page }) => {
    await setup(page);
    await page.goto('/boundless-ops/#/kit');
    const toggle = page.getByTestId('celebration-sound');
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    // stored the same way as the other settings: wait for the kv row before reloading
    await page.waitForFunction(async () => {
      const h = (window as unknown as { __bops: { db: { kv: { get(k: string): Promise<{ value: { celebrationSound?: boolean } } | undefined> } } } }).__bops;
      return (await h.db.kv.get('settings'))?.value.celebrationSound === false;
    });
    await page.reload();
    await expect(page.getByTestId('celebration-sound')).not.toBeChecked();
  });
});
