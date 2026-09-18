import { test, expect } from '@playwright/test';
import { setup } from './helpers';

test.describe('schedule and Phoenix day math', () => {
  test('start date + N days → correct day across Phoenix midnight; rollover after day 14', async ({ page }) => {
    // 23:30 Phoenix on Sep 23 = 06:30 UTC Sep 24 → still Day 03
    await setup(page, { age: 34 }, '2026-09-21', '2026-09-24T06:30:00Z');
    await page.goto('/boundless-ops/#/today');
    await expect(page.getByTestId('day-chip')).toHaveText('Day 03');
    await expect(page.getByTestId('load-chip')).toHaveText('High');
    // cross midnight (31 min later) → Day 04
    await page.clock.runFor(31 * 60_000);
    await expect(page.getByTestId('day-chip')).toHaveText('Day 04', { timeout: 10_000 });
    await expect(page.getByTestId('load-chip')).toHaveText('Moderate');
    // Day 14 (W2 D7 = stamina), Day 42 (W6 D7 = stamina), then the block ends
    await page.clock.setSystemTime(new Date('2026-10-04T20:00:00Z'));
    await page.reload();
    await expect(page.getByTestId('day-chip')).toHaveText('Day 14');
    await expect(page.getByTestId('card-am').getByTestId('session-row').first()).toHaveAttribute('data-session', 'L');
    await page.clock.setSystemTime(new Date('2026-10-11T20:00:00Z'));
    await page.reload();
    await expect(page.getByTestId('day-chip')).toHaveText('Day 21');
    await expect(page.getByTestId('card-main')).toContainText('Yoga');
    await page.clock.setSystemTime(new Date('2026-11-01T20:00:00Z'));
    await page.reload();
    await expect(page.getByTestId('day-chip')).toHaveText('Day 42');
    await expect(page.getByText('Week 6 / 6')).toBeVisible();
    await page.clock.setSystemTime(new Date('2026-11-02T20:00:00Z'));
    await page.reload();
    await expect(page.getByText('Operation Block 01 complete')).toBeVisible();
    await page.getByTestId('start-date-input').fill('2026-11-09');
    await page.getByTestId('start-block').click();
    await expect(page.getByText('Operation Block 02 starts')).toBeVisible();
    await page.clock.setSystemTime(new Date('2026-11-09T20:00:00Z'));
    await page.reload();
    await expect(page.getByTestId('day-chip')).toHaveText('Day 01');
    await expect(page.getByText('Operation Block 02')).toBeVisible();
  });

  test('shift remaining days +1 pushes the schedule', async ({ page }) => {
    await setup(page, {}, '2026-09-21', '2026-09-25T20:00:00Z');
    await page.goto('/boundless-ops/#/today');
    await expect(page.getByTestId('day-chip')).toHaveText('Day 05');
    await page.goto('/boundless-ops/#/schedule');
    page.once('dialog', (d) => d.accept());
    await page.getByTestId('shift-btn').click();
    await expect(page.getByText('shifted +1')).toBeVisible();
    await page.goto('/boundless-ops/#/today');
    await expect(page.getByTestId('day-chip')).toHaveText('Day 04');
  });

  test('schedule grid previews a day and the start date can be edited', async ({ page }) => {
    await setup(page, {}, '2026-09-21');
    await page.goto('/boundless-ops/#/schedule');
    await expect(page.getByTestId('day-13')).toContainText('H');
    await expect(page.getByTestId('week-6')).toBeVisible();
    await expect(page.getByTestId('day-42')).toContainText('L');
    await expect(page.getByTestId('day-20')).toContainText('G');
    await page.getByTestId('day-13').click();
    await expect(page.getByTestId('day-preview')).toContainText('5x4 VO2 max');
    // tap a session in the preview → brief with a Start button → the timer
    await page.getByTestId('day-preview').getByTestId('view-session').filter({ hasText: '5x4' }).click();
    await expect(page.getByTestId('session-detail')).toBeVisible();
    await expect(page.getByTestId('session-brief')).toContainText('87 to 97%');
    await page.getByTestId('brief-start').click();
    await expect(page.getByTestId('timer')).toHaveAttribute('data-segments', '11');
    await page.goto('/boundless-ops/#/schedule');
    await page.getByTestId('day-13').click();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Edit start date' }).click();
    await page.getByTestId('edit-start-input').fill('2026-09-28');
    await page.getByTestId('edit-start-save').click();
    await expect(page.getByText('starts 2026-09-28')).toBeVisible();
  });
});
