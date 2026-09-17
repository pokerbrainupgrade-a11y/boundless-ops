# Boundless HR — Apple Health Shortcut

BOUNDLESS OPS is a web app, so it cannot read HealthKit directly. This iOS Shortcut bridges the gap through the clipboard:

1. At the end of a session the After Action Report form shows **Pull HR from Health**. Tapping it copies `BOPS|<sessionId>|<startISO>|<endISO>` to the clipboard and opens `shortcuts://run-shortcut?name=Boundless%20HR`.
2. The Shortcut reads the clipboard, finds heart-rate samples in that window, computes the average and maximum, copies `BOPS-HR|<sessionId>|<avg>|<max>` to the clipboard, and returns to the app.
3. In the app, tap **Paste HR**. The app validates the prefix and the session ID before saving `hr { avg, max }` on that session.

Manual entry of avg and max HR is always available in the same form.

## Build the Shortcut (action by action)

Open the **Shortcuts** app, tap **+**, and add these actions in order. Tap the name at the top to rename the shortcut exactly **`Boundless HR`** (the app opens it by that name).

| # | Action | Configure |
|---|---|---|
| 1 | **Get Clipboard** | No options. Output is the request text `BOPS\|<sessionId>\|<start>\|<end>`. |
| 2 | **Split Text** | Input: *Clipboard*. Separator: **Custom** → type a single pipe character `\|`. |
| 3 | **Get Item from List** | Input: *Split Text*. Get: **Item at Index** → `2`. Tap the output variable → Rename → `SessionID`. |
| 4 | **Get Item from List** | Input: *Split Text*. **Item at Index** → `3`. Rename → `StartText`. |
| 5 | **Get Item from List** | Input: *Split Text*. **Item at Index** → `4`. Rename → `EndText`. |
| 6 | **Get Dates from Input** | Input: *StartText*. Rename → `StartDate`. |
| 7 | **Get Dates from Input** | Input: *EndText*. Rename → `EndDate`. |
| 8 | **Find Health Samples** | Type: **Heart Rate**. Add Filter → *Start Date* **is after** `StartDate`. Add Filter → *Start Date* **is before** `EndDate`. Sort by: Start Date. Turn **Limit** off. Grant Health access when iOS asks. |
| 9 | **Calculate Statistics** | Input: *Health Samples*. Operation: **Average**. Rename → `AvgHR`. |
| 10 | **Calculate Statistics** | Input: *Health Samples*. Operation: **Maximum**. Rename → `MaxHR`. |
| 11 | **Text** | Type exactly: `BOPS-HR|` then insert variable `SessionID`, then `|`, insert `AvgHR`, then `|`, insert `MaxHR`. No spaces. Result looks like `BOPS-HR|A-20260921T140000|142|171`. |
| 12 | **Copy to Clipboard** | Input: the *Text* from step 11. |
| 13 | **Open URLs** | URL: `https://pokerbrainupgrade-a11y.github.io/boundless-ops/`. If the app is installed on the Home Screen, use **Open App → Boundless Ops** instead so it returns to the installed app. |

Tap **Done**. Run the Shortcut once by hand from the Shortcuts app so it can request Health and clipboard permissions.

## Using it

1. Finish a session and tap **Pull HR from Health** on the After Action Report form.
2. The Shortcut runs and comes back to the app.
3. Tap **Paste HR**. If iOS asks to allow paste, tap **Allow**.
4. If clipboard reading is blocked, open **Paste the result by hand** on the form and paste into the box, then tap **Apply**.

## Notes and troubleshooting

- The session ID is `<sessionId>-<start timestamp>`, so results cannot be mixed between sessions. A result for another session is rejected with a message.
- No samples: the watch or chest strap must have written heart-rate data to Health during the session window. Wrist sensors sample infrequently at rest and lag during 4-minute intervals.
- Empty clipboard: some Shortcuts settings clear the clipboard; run it again.
- Averages come from Health's stored samples, not from a live stream, so the number can differ a little from the watch app's own summary.
- The app never sends any of this anywhere. HR values are stored on the device only.
