/** Screenshot the pose contact sheet to docs/poses.png (needs `npx vite preview` or a dev server on :4174). */
import { chromium } from '@playwright/test';
const url = process.env.POSE_URL ?? 'http://localhost:4174/boundless-ops/#/dev/poses';
const out = process.env.POSE_OUT ?? 'docs/poses.png';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
await page.goto(url);
await page.waitForSelector('[data-testid="pose-sheet"]');
const missing = await page.getAttribute('[data-testid="pose-sheet"]', 'data-missing');
await page.screenshot({ path: out, fullPage: true });
console.log(`saved ${out}; missing poses: ${missing}`);
await browser.close();
