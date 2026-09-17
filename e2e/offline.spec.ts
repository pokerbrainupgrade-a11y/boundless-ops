import { test, expect } from '@playwright/test';
import { setup } from './helpers';

test('installs the service worker, then works offline on every screen and a timer', async ({ page, context }) => {
  await setup(page, {}, '2026-09-21', '2026-09-23T20:00:00Z');
  await page.goto('/boundless-ops/#/today');
  // wait for the SW to be active and the precache to be populated
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg?.active;
  }, undefined, { timeout: 30_000 });
  await page.waitForFunction(async () => (await caches.keys()).length > 0, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1000);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('today')).toBeVisible({ timeout: 15_000 });
  for (const tab of ['schedule', 'library', 'aar', 'intel', 'kit']) {
    await page.goto(`/boundless-ops/#/${tab}`);
    await expect(page.locator('main')).toBeVisible();
  }
  await page.goto('/boundless-ops/#/library/A');
  await expect(page.getByTestId('session-detail')).toBeVisible();
  // a timer runs offline
  await page.goto('/boundless-ops/#/session/coldShower?day=1&slot=am');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('timer')).toHaveAttribute('data-status', 'running');
  await page.getByTestId('skip').click();
  await expect(page.getByTestId('timer')).toHaveAttribute('data-index', '1');
  // a stepper runs offline
  await page.goto('/boundless-ops/#/session/B?day=3&slot=main&variant=seqA');
  await expect(page.getByTestId('stepper-brief')).toBeVisible();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('foundation-stepper')).toBeVisible();
  // fonts came from the cache, not the network
  const fontOk = await page.evaluate(() => document.fonts.check('16px "Black Ops One"') && document.fonts.check('700 16px "JetBrains Mono"') && document.fonts.check('16px Inter'));
  expect(fontOk).toBe(true);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/boundless-ops/#/dev/poses');
  await expect(page.getByTestId('pose-sheet')).toBeVisible();
  await expect(page.getByTestId('pose-sheet')).toHaveAttribute('data-missing', '0');
  expect(errors).toEqual([]);
  await context.setOffline(false);
});

test('manifest and apple meta tags are present', async ({ page, request }) => {
  const m = await (await request.get('/boundless-ops/manifest.webmanifest')).json();
  expect(m.display).toBe('standalone');
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  await page.goto('/boundless-ops/');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  const icon = await request.get('/boundless-ops/icons/apple-touch-icon.png');
  expect(icon.status()).toBe(200);
});
