import { test, expect } from '@playwright/test';
import { setup } from './helpers';

const tabs = ['today', 'schedule', 'library', 'aar', 'intel', 'kit'];

test.describe('smoke', () => {
  for (const tab of tabs) {
    test(`loads #/${tab} at the base path`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await setup(page);
      await page.goto(`/boundless-ops/#/${tab}`);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('nav.tabbar')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('manifest is served with the right scope', async ({ request }) => {
    const res = await request.get('/boundless-ops/manifest.webmanifest');
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m.scope).toBe('/boundless-ops/');
    expect(m.start_url.startsWith('/boundless-ops/')).toBe(true);
    expect(m.name).toBe('BOUNDLESS OPS');
  });

  test('today shows the three mission cards and standing orders once a block starts', async ({ page }) => {
    await setup(page, {}, '2026-09-21', '2026-09-21T20:00:00Z');
    await page.goto('/boundless-ops/#/today');
    await expect(page.getByTestId('day-chip')).toHaveText('Day 01');
    await expect(page.getByText('Operation Block 01')).toBeVisible();
    await expect(page.getByTestId('card-am')).toContainText('AM PT');
    await expect(page.getByTestId('card-main')).toContainText('MAIN EFFORT');
    await expect(page.getByTestId('card-pm')).toContainText('RECOVERY');
    await expect(page.getByTestId('foundation-badge')).toContainText('Seq A');
    await expect(page.getByTestId('habits')).toContainText('DAILY STANDING ORDERS');
    await page.getByTestId('habit-postMealWalk').click();
    await expect(page.getByTestId('habit-postMealWalk')).toHaveAttribute('aria-checked', 'true');
  });
});
