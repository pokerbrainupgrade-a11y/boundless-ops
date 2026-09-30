import { test, expect, type Page } from '@playwright/test';
import { setup } from './helpers';

const LIGHT = '/boundless-ops/#/session/lightMovement?day=1&slot=am';

type Log = { sessionId: string; data: Record<string, unknown> };
const dbLogs = (page: Page) => page.evaluate(() => (window as unknown as { __bops: { db: { logs: { toArray(): Promise<Log[]> } } } }).__bops.db.logs.toArray());

async function endAfter(page: Page, wait: (ms: number) => Promise<void>, ms: number) {
  await page.goto(LIGHT);
  await page.getByTestId('start').click();
  await expect(page.getByTestId('timer')).toHaveAttribute('data-status', 'running');
  await wait(ms);
  await page.getByTestId('end').click();
  await expect(page.getByTestId('timer')).toHaveAttribute('data-status', 'done');
  await page.getByTestId('log-it').click();
}

test.describe('session length', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page, { leadInSec: 10 }, '2026-09-21');
  });

  test('a session under a minute asks to keep or discard; discard saves nothing', async ({ page }) => {
    await endAfter(page, (ms) => page.waitForTimeout(ms), 5_000);
    await expect(page.getByTestId('short-session')).toBeVisible();
    await expect(page.getByTestId('log-form')).toHaveCount(0);
    await expect(page.getByTestId('short-elapsed')).toHaveText(/^0:0[56]$/);
    await page.getByTestId('short-discard').click();
    await expect(page).toHaveURL(/#\/today$/);
    expect(await dbLogs(page)).toHaveLength(0);
  });

  test('keeping a short session opens the report with its real length, not the picker default', async ({ page }) => {
    await endAfter(page, (ms) => page.waitForTimeout(ms), 5_000);
    await page.getByTestId('short-keep').click();
    await expect(page.getByTestId('log-form').getByLabel('Minutes (min)')).toHaveValue('0');
  });

  test('a longer session stores the true elapsed minutes and the AAR shows them', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-21T07:00:00-07:00') });
    // 10 s lead-in + 3:05 of walking = 3:15 total, against a 10-minute plan.
    await endAfter(page, (ms) => page.clock.runFor(ms), 195_000);
    await expect(page.getByTestId('short-session')).toHaveCount(0);
    const form = page.getByTestId('log-form');
    await expect(form.getByLabel('Minutes (min)')).toHaveValue('3');
    await page.getByTestId('save-log').click();
    await expect(page).toHaveURL(/#\/today$/);
    const logs = await dbLogs(page);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.data.minutes).toBe(3);
    await page.goto('/boundless-ops/#/aar');
    await expect(page.getByTestId('aar')).toContainText('Light Fasted Movement');
    await expect(page.getByTestId('aar')).toContainText('3 min');
    await expect(page.getByTestId('aar')).not.toContainText('10 min');
  });
});
