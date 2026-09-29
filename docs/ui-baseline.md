# UI baseline — Phase 0

Snapshot of the UI before any Phase 1 changes. No source code was changed to produce this.

- **Date:** 2026-09-29, commit `f323039`
- **Build:** `vite build`, served with `vite preview` on :4174 (`/boundless-ops/`)
- **Browser:** Playwright MCP, Chromium
- **State in the screenshots:** fresh database → Operation Block 01 started today from the Today screen → one session (Light Fasted Movement, AM) logged through the UI. No supplement stack was imported, so the Today stack strip and wake block are hidden.

## Headline numbers

| # | Measure | Result |
|---|---|---|
| 1 | CSS spacing/size values off the 4px scale | **96** of 245 (39%) |
| 2 | Missing states across Today, Schedule, AAR (of 15 screen×state checks) | **7 missing, 3 partial** |
| 3 | Session logged mid-day survives a reload | **Yes.** In-progress timers and unsaved report forms do not. |
| 4 | Animations that ignore `prefers-reduced-motion` | **2** (of 17 found) |

## Screenshots

`docs/ui-baseline/`. These are full-page captures. The tab bar is `position: fixed`, so a full-page capture paints it once, at the bottom of the first viewport, partway down the image. On a device it stays pinned to the bottom of the screen.

| Screen | 390 px | 1280 px |
|---|---|---|
| Today | [today-390.png](ui-baseline/today-390.png) | [today-1280.png](ui-baseline/today-1280.png) |
| Schedule | [schedule-390.png](ui-baseline/schedule-390.png) | [schedule-1280.png](ui-baseline/schedule-1280.png) |
| AAR | [aar-390.png](ui-baseline/aar-390.png) | [aar-1280.png](ui-baseline/aar-1280.png) |

At 1280 px, every screen is a 640 px centred column (`.screen { max-width: 640px }`) and the tab bar spans the full width. There is no desktop layout.

---

## 1. Spacing and size values off the scale — 96

**The scale.** The app has no declared spacing scale. The tokens it does have (`--gap` 12, `--pad` 16, `--tap` 48, `--tap-lg` 64, `--tabbar-h` 64, `--radius` 4) all sit on a 4px grid, so I measured against multiples of 4px. I also allowed 0, 1px and 2px as hairline micro-values.

**What was counted.** Every `px`/`rem`/`em` length in `src/styles/*.css`, plus every inline `style` string in `src/screens/*.tsx` and `src/components/*.tsx`, including values inside `calc()`. rem/em are converted at 16px. The counted properties are:

- spacing: `padding*`, `margin*`, `gap`
- dimensions: `width`, `height`, `min-*`/`max-*`, `top`/`right`/`bottom`/`left`/`inset`, grid tracks
- corner radius

The size tokens themselves are included. Border widths, letter-spacing, percentages and viewport units are excluded.

| Category | Values | Off scale |
|---|---|---|
| Spacing | 174 | 73 |
| Dimensions | 58 | 19 |
| Radius | 13 | 4 |
| **Total** | **245** | **96** |

**Most frequent off-scale values:** `10px` ×34, `6px` ×27, `14px` ×8, `3px` ×7, `1.2em` ×5, `22px` ×4, `110px` ×3, `18px` ×2, `5px` ×2, `0.6em`, `9px`, `30px`, `130px`. Almost all of these are `10px` or `6px`, which sit between steps of 8/12 and 4/8. A single rule, "10 → 8 or 12, 6 → 4 or 8", would clear 61 of the 96.

### By file

| File | Off scale | Values (line: property = value) |
|---|---|---|
| `src/styles/base.css` | 48 | 25 margin 0.6em · 29 padding-left 1.2em · 63 gap 10px, margin-top 6px · 87 padding 3px 9px · 103 padding 10px 18px · 124 gap 6px · 127 padding 10px · 133 height 30px, border-radius 3px · 134 top 3px, left 3px, width 22px, height 22px · 144 padding 6px · 145 border-radius 3px · 165 width 22px, height 22px · 189 height 10px · 191 gap 10px · 195 padding 10px 14px, gap 10px · 206 padding 6px · 208 padding 10px ×2 · 210 padding-bottom 10px · 218 padding 6px · 222 gap 10px · 224 padding 10px · 244 padding 10px · 249 padding 6px 10px · 265 border-radius 3px · 275 gap 10px · 278 grid rows 14px · 279 width 14px, height 14px · 285 height 10px · 288 height 18px · 307 gap 6px · 330 gap 14px · 332 padding 5px · 337 gap 10px · 338 margin-top 6px, padding-top 14px |
| `src/components/SessionBrief.tsx` | 12 | 42 gap 6px · 44 padding-left 1.2em, gap 6px · 48 gap 6px · 76 padding 10px · 77 gap 10px · 83 padding-left 1.2em, margin 6px · 125 gap 10px, padding 10px · 138 gap 10px, padding 10px |
| `src/screens/Library.tsx` | 5 | 23 padding-bottom calc(… + 110px) · 66, 78, 96, 159 gap 10px |
| `src/components/Chart.tsx` | 4 | 20, 48 gap 6px · 49 width 10px, height 10px |
| `src/components/Labs.tsx` | 4 | 52, 59 width 110px · 59 padding-bottom 14px · 88 gap 6px |
| `src/components/Steppers.tsx` | 4 | 84 gap 10px · 98, 178 padding-left 1.2em · 178 gap 6px |
| `src/components/KitStack.tsx` | 3 | 76 width 130px · 98, 124 gap 6px |
| `src/styles/tokens.css` | 2 | 24 `--radius-sm` 3px · 25 `--notch` 14px |
| `src/components/BreathPacer.tsx` | 2 | 38, 69 gap 6px |
| `src/components/LogForm.tsx` | 2 | 119 gap 6px · 175 margin-top 6px |
| `src/components/SessionRow.tsx` | 2 | 15, 16 gap 10px |
| `src/components/StackRow.tsx` | 2 | 59 gap 6px · 67 padding 10px |
| `src/screens/Kit.tsx` | 1 | 138 gap 6px |
| `src/screens/Schedule.tsx` | 1 | 35 padding 1px 5px (load chip) |
| `src/screens/Session.tsx` | 1 | 72 margin-bottom 6px |
| `src/screens/Stack.tsx` | 1 | 116 gap 6px |
| `src/components/StackCharts.tsx` | 1 | 49 gap 10px |
| `src/components/TimerRunner.tsx` | 1 | 143 margin-bottom 6px |

### Related: type sizes (not counted in the 96)

There are 57 `font-size` declarations, using **25 distinct sizes**: 0.5, 0.55, 0.6, 0.65, 0.66, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.2, 1.35, 1.4, 1.5, 1.6, 1.8, 1.9, 2, 2.2rem, plus 0.85em and 16px. There is no type scale. The smallest is `0.5rem` (8px), used on the Schedule load chips (`Schedule.tsx:35`) and the six-tab bar labels.

---

## 2. Missing states per screen

Legend: ✅ present · ◐ partial · ❌ missing

| State | Today | Schedule | AAR |
|---|---|---|---|
| Empty | ✅ | ◐ | ✅ |
| Error | ❌ | ❌ | ❌ |
| Hover | ❌ | ❌ | ❌ |
| Focus | ✅ | ✅ | ✅ |
| Disabled | ◐ | ◐ | ❌ |

**Missing:** 7 (error ×3, hover ×3, AAR disabled). **Partial:** 3.

### Shared causes

- **Hover.** There are zero `:hover` rules in the codebase. Buttons, day cells, session rows and the Complete All button look the same under a pointer. This matters most at 1280px, where a mouse is likely.
- **Focus.** One global rule, `:focus-visible { outline: 3px solid var(--signal) }` (`base.css:31`), covers every screen, and nothing sets `outline: none`. There is no per-component focus styling.
- **Disabled.** The only disabled style is `.btn:disabled { opacity: 0.45 }` (`base.css:120`). Inputs, `.check` and `.daycell` have no disabled style.
- **Error.** None of the three screens has a `try/catch` or any error UI. Store writes (`startBlock`, `completeDay`, `setCurrentDay`, `setStartDate`, `saveVital`, `toggleHabit`, `deleteLog`) are awaited or `void`-ed with no failure path. An IndexedDB failure — quota, private mode, or iOS eviction, which the app already warns about — fails silently.

### Today
- **Empty ✅.** Each case has its own card: no block (Set your start date), block not started (countdown), block finished (start the next one), and an empty Recovery slot ("Nothing scheduled…").
- **Error ❌.** `completeDay` runs in `try/finally` with no `catch` (`Today.tsx:152`), so a failed save resets the button and says nothing. With an empty date field, Start does nothing and gives no message (`date && startBlock(date)`).
- **Disabled ◐.** Complete All is disabled while busy. The Start button is not disabled when the date field is empty.

### Schedule
- **Empty ◐.** With no block, the 42-day grid still renders with "Day N" labels and no prompt to set a start date. The jump-to-day input is disabled, but the page doesn't say why.
- **Error ❌.** Typing an out-of-range day (e.g. 50) only greys out the button; no message says why. `setCurrentDay` and `setStartDate` are fire-and-forget. Starting the next block uses native `confirm()`.
- **Disabled ◐.** The Set current day button and the preview's Previous/Next buttons use `.btn:disabled`. The disabled jump input has no visual difference from an enabled one.

### AAR
- **Empty ✅.** "No reports yet. Start a session from Today." However, there is no loading state: `allLogs` starts as `[]` and fills after an async Dexie read, so the empty message can flash before the reports appear. Right after navigating, the entry count was briefly 0. An `/aar/:id` URL for a deleted report falls back to the list without saying so.
- **Error ❌.** Delete uses native `confirm()` and has no failure path (`AAR.tsx:74`).
- **Disabled ❌.** Nothing guards Delete or Edit while a delete is running. The block filter buttons show the selected one only by colour (`btn-primary`), with no `aria-pressed`. (The edit view reuses `LogForm`, which does disable FILE REPORT while saving.)

---

## 3. Reload test — the logged session survived

Steps, in Playwright/Chromium against the preview build, at 16:55 local time:

1. Wiped the database, started Operation Block 01 from Today (Day 01, progress `0/4 done`).
2. Light Walk → Start → START → END after about 2.5 s → FILE AAR → typed avg HR 118 → FILE REPORT.
3. Today showed `1/4 done`, with Light Walk as `✓ Again`. IndexedDB held one log: `{id:1, sessionId:"lightMovement", dayN:1, completed:true, hr:{avg:118}}`.
4. **Reloaded the page.** Today still showed `1/4 done` and `✓ Again`, the database row was unchanged, and AAR listed "Light Fasted Movement · am · 10 min · avg HR 118".

**Result: the session survived.** Filed reports go to IndexedDB (Dexie) and reload correctly.

Two things did **not** survive a reload:

- **A running timer.** I reloaded at 0:06 into STAND BY. The page came back to the same URL with the timer `idle`, back on the setup screen. The elapsed time and start time were gone.
- **An unsaved report form.** I reloaded while the FILE REPORT form was open. The page came back on the session setup screen; the draft (times and any typed values) was gone, and the session was not logged.

On iOS, a PWA is often killed in the background mid-session, so both of these amount to losing a session.

Other things I noticed during the test (not investigated):

- A session ended after about 2.5 seconds was filed as `completed: true` and summarised as "10 min", which is the default from the minutes picker, not the elapsed time.
- On Day 01, with one log and no previous export, Today shows "Over 7 days since your last backup". The rule treats "never exported" as "over 7 days", so the text is wrong for a brand-new user.

---

## 4. Animations that ignore reduced motion — 2

I found every animation in CSS and JS, then checked the two JS pacers at runtime with `prefers-reduced-motion: reduce` emulated.

| # | Animation | Where | Respects reduced motion? |
|---|---|---|---|
| 1–6 | CSS keyframes `flash`, `fadein`, `celebrate-glow`, `celebrate-in`, `celebrate-draw`, `celebrate-stamp` | `base.css` | ✅ global `animation: none !important` (`base.css:240`); `--dur: 0ms` |
| 7–12 | CSS transitions on `.card`, `.btn`, `.switch`, `.check .box`, `.timer-bar`, `.stack-check` | `base.css` | ✅ global `transition: none !important` |
| 13 | Screen flash on interval change | `Flash.tsx` | ✅ checks `matchMedia` and skips |
| 14 | CountUp number tick | `Celebration.tsx:29` | ✅ renders the final value when `reducedMotion()` |
| 15 | Confetti canvas | `Celebration.tsx` | ✅ not rendered when `reducedMotion()` |
| 16 | **BreathRing** grow/shrink (rAF loop) | `BreathPacer.tsx:7` | ❌ no check |
| 17 | **BoxBreath** marker around a square (rAF loop) | `BreathPacer.tsx:49` | ❌ no check |

**Runtime check.** With reduced motion emulated, Today had `document.getAnimations().length === 0`, so the CSS kill switch works. On the Decompression Breaths session, the BreathRing circle radius was sampled every 400 ms: `44.0 → 47.3 → 50.5 → 53.8`. It keeps animating. BoxBreath uses the same unguarded `requestAnimationFrame` loop; I confirmed that from the code but did not run it.

**Note.** These two pacers are arguably "essential" motion under WCAG 2.3.3, because the moving shape is what paces the breath. A reduced-motion version could keep the pacing and drop the continuous motion, for example by stepping between two sizes and showing a countdown number.
