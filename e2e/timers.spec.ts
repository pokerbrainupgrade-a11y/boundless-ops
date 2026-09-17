import { test, expect } from '@playwright/test';
import { setup } from './helpers';

const S = { age: 34, leadInSec: 10 };

interface Case { name: string; url: string; segments: number; totalMs: number }
const cases: Case[] = [
  { name: 'Tabata (10 s prep + 8 × 20/10 = 4:10)', url: '/boundless-ops/#/session/A?day=1&slot=main&variant=bike', segments: 17, totalMs: 250_000 },
  { name: '5x4 VO2 max', url: '/boundless-ops/#/session/H?day=13&slot=main', segments: 11, totalMs: 2_410_000 },
  { name: 'Sprints G1', url: '/boundless-ops/#/session/G?day=6&slot=main', segments: 9, totalMs: 1_090_000 },
  { name: '7-Minute (2 rounds)', url: '/boundless-ops/#/session/C?day=2&slot=main', segments: 48, totalMs: 960_000 },
  { name: 'Super-slow', url: '/boundless-ops/#/session/F?day=4&slot=main', segments: 8, totalMs: 280_000 },
  { name: 'Cold shower', url: '/boundless-ops/#/session/coldShower?day=1&slot=am', segments: 21, totalMs: 310_000 },
  { name: 'Cold immersion', url: '/boundless-ops/#/session/coldImmersion?day=6&slot=pm', segments: 2, totalMs: 190_000 },
  { name: 'Sauna', url: '/boundless-ops/#/session/I?day=5&slot=pm', segments: 2, totalMs: 1_210_000 },
  { name: 'Contrast', url: '/boundless-ops/#/session/J?day=7&slot=pm', segments: 5, totalMs: 1_810_000 },
  { name: 'Stamina', url: '/boundless-ops/#/session/L?day=14&slot=am', segments: 2, totalMs: 7_210_000 },
  { name: 'Fasted cardio', url: '/boundless-ops/#/session/fastedCardio?day=2&slot=am', segments: 2, totalMs: 1_210_000 },
  { name: 'Light movement', url: '/boundless-ops/#/session/lightMovement?day=1&slot=am', segments: 2, totalMs: 610_000 },
  { name: 'Post-meal walk', url: '/boundless-ops/#/session/postMealWalk?day=1&slot=habit', segments: 2, totalMs: 910_000 },
  { name: 'Hypoxic swim', url: '/boundless-ops/#/session/D?day=2&slot=main', segments: 20, totalMs: 100_000 },
  { name: 'Yoga', url: '/boundless-ops/#/session/K?day=7&slot=main', segments: 2, totalMs: 2_710_000 },
];

test.describe('timer presets (mocked clock)', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page, S, '2026-09-21');
  });

  for (const c of cases) {
    test(`${c.name}: ${c.segments} segments, ${c.totalMs / 1000}s`, async ({ page }) => {
      await page.clock.install({ time: new Date('2026-09-21T14:00:00-07:00') });
      await page.goto(c.url);
      const timer = page.getByTestId('timer');
      await expect(timer).toBeVisible();
      await expect(timer).toHaveAttribute('data-segments', String(c.segments));
      await expect(timer).toHaveAttribute('data-total-ms', String(c.totalMs));
    });
  }

  test('Tabata runs to completion under a mocked clock and logs per-round reps', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-21T14:00:00-07:00') });
    await page.goto('/boundless-ops/#/session/A?day=1&slot=main&variant=bike');
    const timer = page.getByTestId('timer');
    await page.getByTestId('start').click();
    await expect(timer).toHaveAttribute('data-status', 'running');
    await expect(page.getByTestId('state-label')).toHaveText('STAND BY');
    await page.clock.runFor(10_000);
    await expect(page.getByTestId('state-label')).toHaveText('GO');
    await expect(timer).toHaveAttribute('data-index', '1');
    await page.clock.runFor(20_000);
    await expect(page.getByTestId('state-label')).toHaveText('RECOVER');
    // per-round log during the 10 s rest
    await page.getByTestId('round-log').getByText('+10').click();
    await page.getByTestId('round-log').getByLabel('plus one').click();
    await expect(page.getByTestId('round-val')).toHaveText('11');
    // pause holds time
    await page.getByTestId('pause').click();
    await expect(timer).toHaveAttribute('data-status', 'paused');
    await page.clock.runFor(30_000);
    await expect(timer).toHaveAttribute('data-index', '2');
    await page.getByTestId('pause').click();
    await page.clock.runFor(250_000);
    await expect(timer).toHaveAttribute('data-status', 'done');
    await expect(page.getByText('MISSION COMPLETE')).toBeVisible();
    await page.getByTestId('log-it').click();
    await expect(page.getByTestId('log-form')).toBeVisible();
    await expect(page.locator('[data-testid="log-form"] input[type=number]').first()).toHaveValue('11');
    await page.getByRole('radio', { name: '7' }).click();
    await page.getByTestId('save-log').click();
    await expect(page).toHaveURL(/#\/today/);
    const count = await page.evaluate(() => (window as unknown as { __bops: { db: { logs: { count(): Promise<number> } } } }).__bops.db.logs.count());
    expect(count).toBe(1);
  });

  test('5x4 shows the 87–97% HRmax band from the age in Kit', async ({ page }) => {
    await page.goto('/boundless-ops/#/session/H?day=13&slot=main');
    // age 34 → HRmax 184 → 160–178
    await expect(page.getByTestId('hr-band')).toContainText('160–178 bpm');
  });

  test('Super-slow FAILURE button ends the open lift and records seconds', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-24T14:00:00-07:00') });
    await page.goto('/boundless-ops/#/session/F?day=4&slot=main');
    await page.getByTestId('start').click();
    await page.clock.runFor(10_000);
    await expect(page.getByTestId('lift-card')).toBeVisible();
    await page.clock.runFor(112_000);
    await expect(page.getByTestId('metronome')).toHaveAttribute('data-rep', '3');
    await page.getByTestId('skip').click(); // FAILURE
    await expect(page.getByTestId('lift-rest')).toBeVisible();
    await expect(page.getByTestId('lift-rest')).toContainText('112 s');
    await expect(page.getByTestId('lift-rest')).toContainText('in range');
  });

  test('7-Minute shows the current move drawing and the next preview; W2 uses swaps', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-22T14:00:00-07:00') });
    await page.goto('/boundless-ops/#/session/C?day=2&slot=main');
    expect(await page.getByTestId('brief-move').count()).toBe(12);
    await page.getByTestId('start').click();
    await page.clock.runFor(10_000);
    await expect(page.getByTestId('seven-move')).toHaveAttribute('data-move', 'jumpingJacks');
    await expect(page.getByTestId('seven-move')).toContainText('next: Wall sit');
    await page.clock.runFor(30_000);
    await expect(page.getByTestId('seven-move')).toHaveAttribute('data-move', 'wallSit');
    await page.goto('/boundless-ops/#/session/C?day=9&slot=main');
    await page.getByTestId('start').click();
    await page.clock.runFor(10_000);
    await expect(page.getByTestId('seven-move')).toHaveAttribute('data-move', 'burpees');
  });

  test('Stamina shows the Phoenix rule and fires TURN AROUND at halfway', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-04T12:00:00-07:00') });
    await page.goto('/boundless-ops/#/session/L?day=14&slot=am');
    await expect(page.getByTestId('phoenix-rule')).toBeVisible();
    // 20 min planned → halfway at 10 min
    for (let i = 0; i < 7; i++) await page.getByTestId('minutes-picker').getByLabel('less').click();
    await page.getByTestId('start').click();
    await page.clock.runFor(10_000 + 10 * 60_000 + 500);
    await expect(page.getByTestId('stamina-banner')).toContainText('TURN AROUND');
  });

  test('Steppers: foundation, mobility, decompression reach the AAR form', async ({ page }) => {
    // 08:00 Phoenix on Day 01: a decompression bout logged now counts toward the "wake" standing order
    await page.clock.install({ time: new Date('2026-09-21T15:00:00Z') });
    await page.reload();
    await page.goto('/boundless-ops/#/session/B?day=1&slot=main&variant=seqA');
    // brief first: every exercise is listed before START
    await expect(page.getByTestId('stepper-brief')).toBeVisible();
    expect(await page.getByTestId('brief-exercise').count()).toBe(7);
    await page.getByTestId('start').click();
    const f = page.getByTestId('foundation-stepper');
    await expect(f).toBeVisible();
    for (let i = 0; i < 3; i++) await page.getByTestId('rep-done').click();
    await expect(f).toHaveAttribute('data-index', '1');
    await page.goto('/boundless-ops/#/session/E?day=3&slot=main');
    await expect(page.getByTestId('stepper-brief')).toBeVisible();
    await page.getByTestId('start').click();
    await expect(page.getByTestId('mobility-stepper')).toBeVisible();
    await page.getByLabel('plus one pass').click();
    await expect(page.getByTestId('passes')).toHaveText('1');
    await page.getByTestId('station-done').click();
    await expect(page.getByTestId('mobility-stepper')).toHaveAttribute('data-index', '1');
    await page.goto('/boundless-ops/#/session/decompression?day=1&slot=habit');
    await page.getByTestId('start').click();
    await page.getByTestId('rep-done').click();
    await page.getByTestId('rep-done').click();
    await page.getByTestId('rep-done').click();
    await expect(page.getByTestId('log-form')).toBeVisible();
    await page.getByTestId('save-log').click();
    await page.goto('/boundless-ops/#/today');
    await expect(page.getByTestId('habit-breathWake')).toHaveAttribute('aria-checked', 'true');
  });
});
