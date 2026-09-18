/**
 * iOS cannot fire scheduled reminders from this app: web push needs a server
 * and there isn't one. These are the steps to build the reminders in iOS
 * instead. Mirrored in docs/STACK_REMINDERS.md.
 */
export const REMINDERS_GUIDE = {
  intro:
    'This app has no server, so it cannot send you a notification at 6:30 am. What it can do is show a DUE badge when a block is past its time and still open. For an actual alert, build four repeating reminders in iOS once. It takes about three minutes.',
  why: [
    'Web push on iPhone only works for apps installed to the Home Screen, and only when a server sends the push.',
    'This app is offline and has no backend, so there is nothing to send one.',
    'The Reminders app and Shortcuts both run on a schedule without any of that.',
  ],
  reminders: [
    { block: '01 · ON WAKE', time: '06:30', title: 'Stack · wake', note: 'Empty stomach, about 30 min before food.' },
    { block: '02 · BREAKFAST', time: '07:30', title: 'Stack · breakfast', note: 'With food and dietary fat.' },
    { block: '03 · MIDDAY', time: '12:30', title: 'Stack · midday', note: 'Pre-meal item first, the rest with food.' },
    { block: '04 · BEDTIME', time: '21:30', title: 'Stack · bedtime', note: '30 to 60 min before bed.' },
  ],
  steps: [
    { action: 'Open the Reminders app and pick or make a list called "Stack".', detail: 'Keeping them in one list makes them easy to mute later.' },
    { action: 'Tap + and type the first title, for example "Stack · wake".', detail: 'Use the titles in the table above so they match the app.' },
    { action: 'Tap the ⓘ (details) button on that reminder.', detail: 'This opens date, time, and repeat options.' },
    { action: 'Turn on Date, set today. Turn on Time, set the block time.', detail: 'Match the block times you set in Kit so the app badge and the alert agree.' },
    { action: 'Tap Repeat → Daily. Leave End Repeat Date off.', detail: 'For a weekday-only block choose Custom → Weekly and pick the days.' },
    { action: 'Add the block rule in the Notes field.', detail: 'For example "Empty stomach, about 30 min before food".' },
    { action: 'Tap Done, then repeat for the other three blocks.', detail: 'Four reminders total, one per block.' },
    { action: 'Check that notifications for Reminders are allowed.', detail: 'Settings → Notifications → Reminders → Allow Notifications, with Time Sensitive on if you want them to break through a Focus.' },
  ],
  shortcutAlternative: [
    'One automation instead of four reminders: Shortcuts app → Automation → + → Time of Day.',
    'Set the time, choose Daily, and turn off "Ask Before Running".',
    'Add the action "Show Notification" with the block name, then add "Open App" and pick Boundless Ops so the tap lands in the app.',
    'Duplicate the automation three times and change the time and text for each block.',
  ],
  notes: [
    'The app never sends a notification. Nothing you do in the app changes these reminders, and nothing here reads your stack.',
    'Checking an item in the app does not clear the iOS reminder, and clearing the reminder does not check the item.',
    'If you change a block time in Kit, change the matching reminder too.',
  ],
};
