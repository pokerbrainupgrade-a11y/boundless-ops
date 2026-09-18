import { test, expect } from '@playwright/test';
import { setup } from './helpers';
import { demoSeed } from './fixtures';

/** Import the seed through the debug hook so every test starts from a known stack. */
async function seedStack(page: import('@playwright/test').Page) {
  await page.evaluate(async (seed) => {
    const h = (window as unknown as { __bops: { importStackSeed: (s: unknown) => Promise<void> } }).__bops;
    await h.importStackSeed(seed);
  }, demoSeed());
}

test.describe('stack', () => {
  test('empty state points at the importer, and the tab is reachable', async ({ page }) => {
    await setup(page, {}, '2026-09-21', '2026-09-21T20:00:00Z');
    await page.goto('/boundless-ops/#/stack');
    await expect(page.getByTestId('stack-empty')).toBeVisible();
    await expect(page.locator('nav.tabbar')).toHaveAttribute('data-count', '6');
    await expect(page.locator('nav.tabbar a', { hasText: 'STACK' })).toBeVisible();
  });

  test('completes all four blocks in one day and keeps the state across a reload', async ({ page }) => {
    // Monday 2026-09-21 at 13:00 Phoenix: cycle day 1 of 5, high-load Day 01
    await setup(page, {}, '2026-09-21', '2026-09-21T20:00:00Z');
    await seedStack(page);
    await page.goto('/boundless-ops/#/stack');
    await expect(page.getByTestId('block-wake')).toBeVisible();

    // wake: one required item (the cycled one, on today) + one as-needed
    await expect(page.getByTestId('block-wake').getByTestId('block-count')).toHaveText('0/1');
    await expect(page.getByTestId('block-wake').getByTestId('cycle-on')).toContainText('cycle day 1/5');
    await page.getByTestId('block-wake').getByTestId('stack-check').first().click();
    await expect(page.getByTestId('block-wake')).toHaveAttribute('data-complete', 'true');

    // breakfast: two plain items
    for (const c of await page.getByTestId('block-breakfast').getByTestId('stack-check').all()) await c.click();
    await expect(page.getByTestId('block-breakfast')).toHaveAttribute('data-complete', 'true');

    // midday: a 3-unit counter plus a ceiling-flagged item
    await expect(page.getByTestId('block-midday').getByTestId('ceiling-flag')).toContainText('ceiling is 400');
    const units = page.getByTestId('unit-counter').first().locator('.unit');
    await units.nth(0).click();
    await expect(page.getByTestId('block-midday').getByTestId('block-count')).toHaveText('1/4');
    await units.nth(2).click();
    await expect(page.getByTestId('block-midday').getByTestId('block-count')).toHaveText('3/4');
    await page.getByTestId('block-midday').getByTestId('stack-check').first().click();
    await expect(page.getByTestId('block-midday')).toHaveAttribute('data-complete', 'true');

    // bedtime
    await page.getByTestId('block-bedtime').getByTestId('stack-check').first().click();
    await expect(page.getByTestId('block-bedtime')).toHaveAttribute('data-complete', 'true');

    // the streak counts the day once every required item is in
    await expect(page.getByTestId('streak')).toHaveText('1');

    await page.reload();
    await expect(page.getByTestId('streak')).toHaveText('1');
    for (const b of ['wake', 'breakfast', 'midday', 'bedtime']) {
      await expect(page.getByTestId(`block-${b}`), b).toHaveAttribute('data-complete', 'true');
    }
    await expect(page.getByTestId('unit-counter').first().locator('.unit.on')).toHaveCount(3);
  });

  test('a cycle off day is struck through until a long press unlocks it', async ({ page }) => {
    // 2026-09-26 is day 1 of the 2-day off phase
    await setup(page, {}, '2026-09-21', '2026-09-26T20:00:00Z');
    await seedStack(page);
    await page.goto('/boundless-ops/#/stack');
    const row = page.getByTestId('stack-row').filter({ hasText: 'Cycled item' });
    await expect(row).toHaveAttribute('data-off-day', 'true');
    await expect(page.getByTestId('cycle-chip')).toHaveText('OFF DAY 1/2');
    // wake has no required items on an off day
    await expect(page.getByTestId('block-wake').getByTestId('block-count')).toHaveText('0/0');
    // a plain tap does nothing
    await row.getByTestId('stack-check').click();
    await expect(row).toHaveAttribute('data-done', 'false');
    // press and hold, then tap
    await row.hover();
    await page.mouse.down();
    await page.waitForTimeout(750);
    await page.mouse.up();
    await expect(row).toContainText('Unlocked');
    await row.getByTestId('stack-check').click();
    await expect(row).toHaveAttribute('data-done', 'true');
  });

  test('Today shows the block strip, the wake block, and the high-load prompt', async ({ page }) => {
    await setup(page, {}, '2026-09-21', '2026-09-21T20:00:00Z');
    await seedStack(page);
    await page.goto('/boundless-ops/#/today');
    await expect(page.getByTestId('stack-strip')).toContainText('0 of 4 blocks done');
    await expect(page.getByTestId('wake-block')).toBeVisible();
    // Day 01 is a High-load day, so the high-load item says so
    await expect(page.getByTestId('wake-block').getByTestId('row-note')).toContainText('High-load day');
    await page.getByTestId('wake-block').getByTestId('stack-check').first().click();
    await expect(page.getByTestId('stack-strip')).toContainText('1 of 4 blocks done');
    await page.getByTestId('stack-strip').getByRole('button').click();
    await expect(page.getByTestId('stack')).toBeVisible();
  });

  test('a fasted-cardio day holds the breakfast block until the AM session is logged', async ({ page }) => {
    // Day 02 runs fasted cardio in the AM
    await setup(page, {}, '2026-09-21', '2026-09-22T20:00:00Z');
    await seedStack(page);
    await page.goto('/boundless-ops/#/stack');
    await expect(page.getByTestId('fasted-hold')).toContainText('Hold this block');
    await expect(page.getByTestId('block-breakfast').getByTestId('row-note').first()).toContainText('Fasted session');
  });

  test('inventory chips appear once the toggle and container size are set', async ({ page }) => {
    await setup(page, {}, '2026-09-21', '2026-09-21T20:00:00Z');
    await seedStack(page);
    await page.goto('/boundless-ops/#/kit');
    await page.getByTestId('inventory-toggle').check();
    await page.getByTestId('kit-item').filter({ hasText: 'Inventory item' }).click();
    await page.getByTestId('edit-percontainer').fill('20');
    await page.getByTestId('edit-onhand').fill('1');
    await page.getByTestId('save-item').click();
    await page.goto('/boundless-ops/#/stack');
    // 20 units, 2 per day = 10 days left → red
    await expect(page.getByTestId('inv-chip')).toHaveText('10 d left');
    await page.getByRole('button', { name: 'Logged a refill' }).click();
    await expect(page.getByTestId('inv-chip')).toHaveText('20 d left');
  });

  test('labs: log a panel, see the trend and the next-due date', async ({ page }) => {
    await setup(page, {}, '2026-09-21', '2026-09-21T20:00:00Z');
    await seedStack(page);
    await page.goto('/boundless-ops/#/intel/labs');
    await expect(page.getByTestId('panel-due')).toContainText('No panel logged yet');
    await page.getByTestId('add-panel').click();
    await page.getByTestId('lab-totalT').fill('612');
    await page.getByTestId('lab-vitD25OH').fill('48');
    await page.getByTestId('save-panel').click();
    await expect(page.getByTestId('lab-chart-vitD25OH')).toBeVisible();
    await expect(page.getByTestId('vitd-status')).toContainText('in band');
    // 2026-09-21 + 90 days = 2026-12-20
    await expect(page.getByTestId('panel-due')).toContainText('Dec 20, 2026');
    await expect(page.getByTestId('panel-row')).toHaveCount(1);
  });

  test('stack adherence charts render from logged days', async ({ page }) => {
    await setup(page, {}, '2026-09-21', '2026-09-21T20:00:00Z');
    await seedStack(page);
    await page.goto('/boundless-ops/#/stack');
    await page.getByTestId('block-wake').getByTestId('stack-check').first().click();
    await page.goto('/boundless-ops/#/intel/stack');
    await expect(page.getByTestId('chart-heatmap')).toBeVisible();
    await expect(page.getByTestId('chart-adherence')).toBeVisible();
    await expect(page.getByTestId('chart-cycle')).toContainText('5 on / 2 off');
    await expect(page.getByTestId('chart-streaks')).toBeVisible();
  });

  test('works offline and survives a reload', async ({ page, context }) => {
    await setup(page, {}, '2026-09-21', '2026-09-21T20:00:00Z');
    await seedStack(page);
    await page.goto('/boundless-ops/#/stack');
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, undefined, { timeout: 30_000 });
    await page.waitForFunction(async () => (await caches.keys()).length > 0, undefined, { timeout: 30_000 });
    await page.waitForTimeout(500);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('block-wake')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('block-wake').getByTestId('stack-check').first().click();
    await expect(page.getByTestId('block-wake')).toHaveAttribute('data-complete', 'true');
    await page.reload();
    await expect(page.getByTestId('block-wake')).toHaveAttribute('data-complete', 'true');
    await context.setOffline(false);
  });

  test('export carries the stack and import restores it', async ({ page }) => {
    await setup(page, {}, '2026-09-21', '2026-09-21T20:00:00Z');
    await seedStack(page);
    await page.goto('/boundless-ops/#/stack');
    await page.getByTestId('block-wake').getByTestId('stack-check').first().click();
    await page.goto('/boundless-ops/#/kit');
    await expect(page.getByTestId('export-privacy')).toContainText('Keep it somewhere private');
    await expect(page.getByTestId('storage-status')).toContainText('7 stack items');
    const dl = page.waitForEvent('download');
    await page.getByTestId('export-btn').click();
    const file = await (await dl).path();
    await page.evaluate(async () => {
      const h = (window as unknown as { __bops: { db: { stackItems: { clear(): Promise<void> }; stackLogs: { clear(): Promise<void> } }; reloadStack: () => Promise<void> } }).__bops;
      await h.db.stackItems.clear();
      await h.db.stackLogs.clear();
      await h.reloadStack();
    });
    await page.reload();
    await expect(page.getByTestId('storage-status')).toContainText('0 stack items');
    await page.getByTestId('import-input').setInputFiles(file!);
    page.once('dialog', (d) => d.accept());
    await page.getByTestId('import-replace').click();
    await expect(page.getByTestId('kit-msg')).toContainText('7 stack items');
    await page.goto('/boundless-ops/#/stack');
    await expect(page.getByTestId('block-wake')).toHaveAttribute('data-complete', 'true');
  });
});
