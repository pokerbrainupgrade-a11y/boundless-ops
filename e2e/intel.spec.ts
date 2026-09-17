import { test, expect } from '@playwright/test';
import { setup, seed } from './helpers';
import { demoExport } from './fixtures';

const CHARTS = ['tabata-total', 'tabata-rounds', 'superslow-seconds', 'superslow-load', 'vo2-hr', 'sauna', 'stamina', 'cold', 'vitals'];

test('seeded data renders every chart in W1/W2 and Block modes', async ({ page }) => {
  await setup(page);
  await seed(page, demoExport());
  await page.goto('/boundless-ops/#/intel');
  await expect(page.getByTestId('intel')).toHaveAttribute('data-mode', 'weeks');
  // default block is the latest (Block 02) which only has tabata + super-slow; pick Block 01 for all charts
  await page.getByRole('button', { name: 'Block 01' }).click();
  for (const id of CHARTS) {
    const c = page.getByTestId(`chart-${id}`);
    await expect(c).toBeVisible();
    await expect(c, id).toHaveAttribute('data-empty', 'false');
    expect(await c.locator('svg rect, svg polyline').count(), id).toBeGreaterThan(0);
  }
  await expect(page.getByTestId('chart-tabata-total')).toContainText('Week 1');
  await expect(page.getByTestId('chart-tabata-total')).toContainText('Week 2');
  await page.getByTestId('mode-blocks').click();
  await expect(page.getByTestId('intel')).toHaveAttribute('data-mode', 'blocks');
  for (const id of CHARTS) {
    const c = page.getByTestId(`chart-${id}`);
    await expect(c, id).toHaveAttribute('data-empty', 'false');
  }
  await expect(page.getByTestId('chart-tabata-total')).toContainText('Block 01');
  await expect(page.getByTestId('chart-tabata-total')).toContainText('Block 02');
  await page.screenshot({ path: 'test-results/intel.png', fullPage: true });
});

test('AAR lists seeded sessions and edits one', async ({ page }) => {
  await setup(page);
  await seed(page, demoExport());
  await page.goto('/boundless-ops/#/aar');
  await page.getByRole('button', { name: 'All' }).click();
  expect(await page.getByTestId('aar-entry').count()).toBeGreaterThan(10);
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await expect(page.getByTestId('log-form')).toBeVisible();
  await page.getByRole('radio', { name: '8' }).click();
  await page.getByTestId('save-log').click();
  await expect(page).toHaveURL(/#\/aar$/);
  await expect(page.getByTestId('aar-entry').first()).toContainText('RPE 8');
});

test('export → wipe → import through the Kit screen restores the records', async ({ page }) => {
  await setup(page);
  await seed(page, demoExport());
  await page.goto('/boundless-ops/#/kit');
  await expect(page.getByTestId('storage-status')).toContainText('25 reports');
  // export via the download path (no Web Share in headless)
  const dl = page.waitForEvent('download');
  await page.getByTestId('export-btn').click();
  const file = await dl;
  const path = await file.path();
  await expect(page.getByTestId('kit-msg')).toContainText('Exported boundless-ops-backup-');
  // wipe
  await page.evaluate(async () => { const h = (window as unknown as { __bops: { db: { blocks: { clear(): Promise<void> }; logs: { clear(): Promise<void> }; habits: { clear(): Promise<void> }; vitals: { clear(): Promise<void> } }; reloadBlocks: () => Promise<void>; reloadLogs: () => Promise<void> } }).__bops; await h.db.blocks.clear(); await h.db.logs.clear(); await h.db.habits.clear(); await h.db.vitals.clear(); await h.reloadBlocks(); await h.reloadLogs(); });
  await page.reload();
  await expect(page.getByTestId('storage-status')).toContainText('0 reports');
  // import → replace
  await page.getByTestId('import-input').setInputFiles(path!);
  await expect(page.getByTestId('import-prompt')).toContainText('25 reports, 2 blocks');
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('import-replace').click();
  await expect(page.getByTestId('kit-msg')).toContainText('Imported (replace)');
  await expect(page.getByTestId('storage-status')).toContainText('25 reports');
});
