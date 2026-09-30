import { test, expect, type Page } from '@playwright/test';
import { setup } from './helpers';

const LIGHT = '/boundless-ops/#/session/lightMovement?day=1&slot=am';

const elapsedMs = async (page: Page) => Number(await page.getByTestId('timer').getAttribute('data-elapsed-ms'));

test.describe('reload survival', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page, { leadInSec: 10 }, '2026-09-21');
  });

  test('a running timer survives a reload and keeps counting from its start time', async ({ page }) => {
    await page.goto(LIGHT);
    // Non-default options must come back too, so the same plan rebuilds (10 → 15 min).
    await page.getByTestId('minutes-picker').getByLabel('more').click();
    const timer = page.getByTestId('timer');
    await expect(timer).toHaveAttribute('data-total-ms', '910000');
    await page.getByTestId('start').click();
    await expect(timer).toHaveAttribute('data-status', 'running');
    await page.waitForTimeout(10_000);

    await page.reload();
    await expect(timer).toHaveAttribute('data-status', 'running');
    await expect(timer).toHaveAttribute('data-total-ms', '910000');
    expect(await elapsedMs(page)).toBeGreaterThanOrEqual(10_000);
    // Still ticking after the reload, not frozen at the restored value.
    const before = await elapsedMs(page);
    await page.waitForTimeout(1_500);
    expect(await elapsedMs(page)).toBeGreaterThan(before);
  });

  test('relaunching at the start URL returns to the running timer', async ({ page }) => {
    await page.goto(LIGHT);
    await page.getByTestId('start').click();
    await expect(page.getByTestId('timer')).toHaveAttribute('data-status', 'running');
    await page.waitForTimeout(2_000);
    await page.goto('/boundless-ops/#/today');
    await page.reload();
    await expect(page).toHaveURL(/#\/session\/lightMovement\?day=1&slot=am$/);
    await expect(page.getByTestId('timer')).toHaveAttribute('data-status', 'running');
    expect(await elapsedMs(page)).toBeGreaterThanOrEqual(2_000);
  });

  test('ending the timer clears the saved run', async ({ page }) => {
    await page.goto(LIGHT);
    await page.getByTestId('start').click();
    await page.getByTestId('end').click();
    await expect(page.getByTestId('timer')).toHaveAttribute('data-status', 'done');
    expect(await page.evaluate(() => localStorage.getItem('bops.active'))).toBeNull();
    await page.reload();
    await expect(page.getByTestId('timer')).toHaveAttribute('data-status', 'idle');
  });
});
