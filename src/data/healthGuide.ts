/** Step-by-step build of the "Boundless HR" iOS Shortcut. Mirrored in docs/HEALTH_SHORTCUT.md. */
export const HEALTH_GUIDE = {
  name: 'Boundless HR',
  intro: 'A web app cannot read Apple Health. This Shortcut reads the session window from the clipboard, pulls heart-rate samples from Health, and puts the result back on the clipboard for the app to paste.',
  steps: [
    { action: 'Open the Shortcuts app → + (new shortcut). Tap the name at the top and rename it exactly:', detail: 'Boundless HR' },
    { action: 'Add action: Get Clipboard.', detail: 'Output: the text "BOPS|<sessionId>|<startISO>|<endISO>".' },
    { action: 'Add action: Split Text.', detail: 'Input: Clipboard. Separator: Custom → "|" (a single pipe character).' },
    { action: 'Add action: Get Item from List → Item at Index 2.', detail: 'Input: Split Text. Rename the output variable "SessionID" (tap the variable → Rename).' },
    { action: 'Add action: Get Item from List → Item at Index 3.', detail: 'Input: Split Text. Rename it "StartText".' },
    { action: 'Add action: Get Item from List → Item at Index 4.', detail: 'Input: Split Text. Rename it "EndText".' },
    { action: 'Add action: Get Dates from Input.', detail: 'Input: StartText. Rename the output "StartDate".' },
    { action: 'Add action: Get Dates from Input.', detail: 'Input: EndText. Rename the output "EndDate".' },
    { action: 'Add action: Find Health Samples.', detail: 'Type: Heart Rate. Add filter: Start Date is after StartDate. Add filter: Start Date is before EndDate. Sort by Start Date. Untick "Limit". Allow Health access when asked.' },
    { action: 'Add action: Calculate Statistics → Average.', detail: 'Input: Health Samples. Rename the output "AvgHR".' },
    { action: 'Add action: Calculate Statistics → Maximum.', detail: 'Input: Health Samples. Rename the output "MaxHR".' },
    { action: 'Add action: Text.', detail: 'Content exactly: BOPS-HR|SessionID|AvgHR|MaxHR (insert the three variables; keep the pipes, no spaces).' },
    { action: 'Add action: Copy to Clipboard.', detail: 'Input: the Text from the previous step.' },
    { action: 'Add action: Open URLs.', detail: 'URL: https://pokerbrainupgrade-a11y.github.io/boundless-ops/ (once the app is installed on the Home Screen, use Open App → Boundless Ops instead so it returns to the installed app).' },
    { action: 'Tap Done. Run it once by hand from Shortcuts to grant Health and clipboard permissions.', detail: 'In Shortcuts → Settings → Advanced, allow "Allow Sharing Large Amounts of Data" if prompted.' },
  ],
  usage: [
    'Finish a session in the app and tap "Pull HR from Health". The app copies the request to the clipboard and opens the Shortcut.',
    'The Shortcut runs, copies the result, and returns to the app.',
    'Tap "Paste HR". iOS may ask to allow paste; tap Allow. The app checks the prefix and session ID before saving.',
    'If the paste is blocked, open "Paste the result by hand" and paste into the box.',
  ],
  troubleshooting: [
    'No samples: the watch or strap must have written heart-rate data to Health during the session window. Wrist sensors sample less often at rest.',
    'Wrong session: the result carries the session ID of the request you copied. Pull again from the session you are logging.',
    'Empty clipboard: run the Shortcut again; some Shortcuts settings clear the clipboard on exit.',
    'Manual entry always works: type avg and max HR into the fields.',
  ],
};
