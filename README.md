# BOUNDLESS OPS

An installable, offline-first web app for iPhone that runs and logs a 14-day training program on the gym floor, then repeats it in Operation Blocks. Dark field-manual UI, big tap targets, timestamp-accurate interval timers, and on-device After Action Reports with Intel charts.

**Live:** https://pokerbrainupgrade-a11y.github.io/boundless-ops/

Everything is stored on the device. No account, no backend, no analytics.

## Install on iPhone

1. Open the live URL in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open it from the Home Screen once while online. After that it works in airplane mode.

The first screen asks for a start date (Day 01). Today's day is computed on the Phoenix calendar.

## What it does

- **Today** — block, day, week, and load tag; AM PT / MAIN EFFORT / RECOVERY mission cards with one-tap timers; Daily Standing Orders checklist; morning resting HR / HRV entry; a backup reminder when the last export is more than 7 days old.
- **Schedule** — the 14-day grid, day previews, "shift remaining days +1" for a missed day, start-date editor, next block.
- **Library** — every session A–L, the Foundation sequences, 7-minute moves, super-slow patterns, and mobility stations with original line drawings, cues, and safety notes; searchable. A Reference tab holds the standing protocols, Phoenix adjustments, execution rules, dose framework, and evidence flags.
- **AAR** — every After Action Report by block and day, editable.
- **Intel** — Tabata totals and per-round drop-off, super-slow seconds-to-failure and load, 5x4 HR per round, sauna minutes, stamina, cold dose, and resting HR/HRV, each with W1 vs W2 and Block vs Block toggles.
- **Timers** — Tabata, 5x4 VO2 max, sprints (G1/G2/G3), 7-minute (W2 explosive swaps), super-slow (tempo metronome + FAILURE button), cold shower cycle, cold immersion, sauna with a box-breathing pacer, hot-cold contrast, stamina with halfway and hydration alerts, simple countdowns, and steppers for Foundation, mobility, and decompression breathing. Cues are beeps plus a full-screen color flash; the screen stays awake while a timer runs.
- **Apple Health bridge** — pulls average and max heart rate for a session through an iOS Shortcut and the clipboard. See [docs/HEALTH_SHORTCUT.md](docs/HEALTH_SHORTCUT.md). Manual entry always works.

## Back up your data

iOS can evict site data. The JSON export is the only backup.

1. **Kit → Backup → Export JSON.** On iPhone this opens the share sheet; choose **Save to Files**.
2. To restore on any device: **Kit → Import JSON**, pick the file, then choose **Merge** or **Replace**.

## Local development

```bash
npm install
npm run dev          # http://localhost:5173/boundless-ops/
npm test             # unit tests (Vitest)
npm run build        # verify program data + typecheck + production build
npm run test:e2e     # Playwright against the built app (run npm run build first)
npm run icons        # regenerate PNG icons from assets/icon.svg
```

- `npm run verify` checks the program data (`src/data/program.json`) against its schema and prints the day-by-day table.
- `#/dev/poses` shows a contact sheet of every line drawing ([docs/poses.png](docs/poses.png)).
- Deploys run from `.github/workflows/deploy.yml` on every push to `main`: unit tests → build → e2e → GitHub Pages.

## Stack

Vite, TypeScript, Preact + signals, `vite-plugin-pwa` (Workbox), Dexie (IndexedDB), Zod, Vitest, Playwright. Plain CSS with custom properties; self-hosted fonts via `@fontsource`. No UI kit, no chart library.

## Notes

- All day math uses the `America/Phoenix` calendar.
- Timers are timestamp-based and recompute their state when the app returns from the background.
- The iPhone silent switch mutes web audio; the color flash is the backup cue.
- Personal use. Not medical advice.
