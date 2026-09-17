import type { Page } from '@playwright/test';

export interface TestSettings {
  age?: number | null;
  leadInSec?: number;
  sound?: boolean;
  flash?: boolean;
  callsign?: string;
}

/** Load the app, apply settings through the debug hook, and start a block if asked. */
export async function setup(page: Page, s: TestSettings = {}, startDate?: string, time?: Date | string) {
  if (time) await page.clock.install({ time: typeof time === 'string' ? new Date(time) : time });
  await page.goto('/boundless-ops/#/kit');
  await page.waitForFunction(() => !!(window as unknown as { __bops?: unknown }).__bops);
  await page.evaluate(async ({ s, startDate }) => {
    const h = (window as unknown as { __bops: { updateSettings: (p: object) => Promise<void>; startBlock: (d: string) => Promise<unknown>; db: { blocks: { count(): Promise<number> } } } }).__bops;
    await h.updateSettings({ silentSwitchWarned: true, sound: false, flash: false, ...s });
    if (startDate && (await h.db.blocks.count()) === 0) await h.startBlock(startDate);
  }, { s, startDate });
}

export async function seed(page: Page, data: unknown) {
  await page.evaluate(async (d) => {
    const h = (window as unknown as { __bops: { applyImport: (d: unknown, m: string) => Promise<void>; reloadBlocks: () => Promise<void>; reloadLogs: () => Promise<void> } }).__bops;
    await h.applyImport(d, 'replace');
    await h.reloadBlocks();
    await h.reloadLogs();
  }, data);
}

export async function wipe(page: Page) {
  await page.goto('/boundless-ops/#/kit');
  await page.waitForFunction(() => !!(window as unknown as { __bops?: unknown }).__bops);
  await page.evaluate(async () => {
    const h = (window as unknown as { __bops: { db: { delete(): Promise<void> } } }).__bops;
    await h.db.delete();
  });
  await page.reload();
}
