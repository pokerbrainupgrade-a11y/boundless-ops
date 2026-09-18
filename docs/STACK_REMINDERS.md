# Stack reminders on iPhone

BOUNDLESS OPS cannot send you a notification at 6:30 am, and it does not pretend to.

Web push on iPhone works only for apps installed to the Home Screen, and only when a **server** sends the push. This app is offline-first with no backend, so there is nothing to send one. What the app does instead:

- A block shows a **DUE** badge once its time has passed and it is still open.
- The Today tab shows four block dots, filled as each block completes.

For an actual alert, build the reminders once in iOS. Three minutes, and they keep working whether or not you open the app.

## The four reminders

Use the block times you set in **Kit → Block times** so the badge in the app and the alert on your phone agree. The defaults are:

| Block | Time | Reminder title | Note to paste |
|---|---|---|---|
| 01 · ON WAKE | 06:30 | `Stack · wake` | Empty stomach, about 30 min before food. |
| 02 · BREAKFAST | 07:30 | `Stack · breakfast` | With food and dietary fat. |
| 03 · MIDDAY | 12:30 | `Stack · midday` | Pre-meal item first, the rest with food. |
| 04 · BEDTIME | 21:30 | `Stack · bedtime` | 30 to 60 min before bed. |

## Build them in Reminders

1. Open the **Reminders** app. Make a list called **Stack** (keeping them together makes them easy to mute later).
2. Tap **+** and type the first title, for example `Stack · wake`.
3. Tap the **ⓘ** details button on that reminder.
4. Turn on **Date** and set today. Turn on **Time** and set the block time.
5. Tap **Repeat → Daily**. Leave **End Repeat Date** off.
6. Paste the block rule into **Notes**.
7. Tap **Done**. Repeat for the other three blocks.
8. Check **Settings → Notifications → Reminders → Allow Notifications**. Turn on **Time Sensitive** if you want them to break through a Focus.

For a block you only want on some days, use **Repeat → Custom → Weekly** and pick the days.

## One Shortcuts automation instead

1. **Shortcuts → Automation → + → Time of Day.**
2. Set the time, choose **Daily**, and turn **Ask Before Running** off.
3. Add **Show Notification** with the block name.
4. Add **Open App** and pick **Boundless Ops**, so the tap lands in the app.
5. Duplicate it three times and change the time and text for each block.

## What these do and don't do

- The app never sends a notification and never reads your reminders. The two are independent.
- Checking an item in the app does not clear the iOS reminder, and clearing a reminder does not check an item.
- If you change a block time in Kit, change the matching reminder too.
- Nothing in your protocol is copied into Reminders unless you type it there yourself. The titles above are deliberately generic.
