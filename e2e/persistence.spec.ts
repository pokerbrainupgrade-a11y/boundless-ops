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

  const openReport = async (page: Page) => {
    await page.goto(LIGHT);
    await page.getByTestId('start').click();
    await page.getByTestId('end').click();
    await page.getByTestId('log-it').click();
    await expect(page.getByTestId('log-form')).toBeVisible();
  };

  test('an unsaved report draft survives a reload and is cleared once filed', async ({ page }) => {
    await openReport(page);
    const form = page.getByTestId('log-form');
    await form.getByRole('radio', { name: '6' }).click();
    await page.getByTestId('hr-avg').fill('118');
    await page.getByTestId('hr-max').fill('131');
    await form.getByLabel('Notes').fill('Easy loop around the block');

    await page.reload();
    await expect(form).toBeVisible();
    await expect(form.getByRole('radio', { name: '6' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('hr-avg')).toHaveValue('118');
    await expect(page.getByTestId('hr-max')).toHaveValue('131');
    await expect(form.getByLabel('Notes')).toHaveValue('Easy loop around the block');

    // A relaunch at the start URL goes back to the unfiled report.
    await page.goto('/boundless-ops/#/today');
    await page.reload();
    await expect(form).toBeVisible();
    await expect(page.getByTestId('hr-avg')).toHaveValue('118');

    await page.getByTestId('save-log').click();
    await expect(page).toHaveURL(/#\/today$/);
    expect(await page.evaluate(() => localStorage.getItem('bops.report'))).toBeNull();
    await page.goto('/boundless-ops/#/aar');
    await expect(page.getByTestId('aar')).toContainText('avg HR 118');
  });

  test('discarding a report clears its draft', async ({ page }) => {
    await openReport(page);
    await page.getByTestId('hr-avg').fill('120');
    await page.getByTestId('discard-log').click();
    await expect(page).toHaveURL(/#\/today$/);
    expect(await page.evaluate(() => localStorage.getItem('bops.report'))).toBeNull();
    await page.goto(LIGHT);
    await expect(page.getByTestId('timer')).toHaveAttribute('data-status', 'idle');
  });

  test('an edit to a filed report survives a reload', async ({ page }) => {
    await openReport(page);
    await page.getByTestId('hr-avg').fill('118');
    await page.getByTestId('save-log').click();
    await expect(page).toHaveURL(/#\/today$/);
    await page.goto('/boundless-ops/#/aar');
    await page.getByTestId('aar').getByRole('button', { name: 'Edit' }).first().click();
    await expect(page.getByTestId('log-form')).toBeVisible();
    await page.getByTestId('hr-avg').fill('124');
    await page.reload();
    await expect(page.getByTestId('hr-avg')).toHaveValue('124');
  });
});
