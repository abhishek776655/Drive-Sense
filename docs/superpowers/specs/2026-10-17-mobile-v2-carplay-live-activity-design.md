# DriveSense v2: CarPlay through a Live Activity and a widget

Date: 2026-10-17
App: `drive-sense-v2` (Expo SDK 57)

## Goal

Put DriveSense in the car without needing Apple's CarPlay entitlement:
- a **Live Activity** while a drive is recording, shown on the CarPlay Dashboard, the lock screen
  and the Dynamic Island;
- a **widget** with this week's driving, shown on the CarPlay widget screen and on the iPhone home
  and lock screens.

## Decisions

- **Approach A (no CarPlay entitlement).** A full CarPlay app needs Apple's Driving Task
  entitlement, which needs a paid account and Apple's approval. Apple shows Live Activities and
  small widgets in CarPlay automatically, with no entitlement.
- **Live Activity content:** time, distance, average speed and live score. Current speed is
  not shown (the car already has a speedometer). There is no speed-alert state for now.
- **Widget:** small shows this week; medium adds the last drive. CarPlay shows only small.
- **Library:** `expo-widgets` (stable since SDK 56), with layouts in JSX using `@expo/ui/swift-ui`.
  It needs a development build and does not run in Expo Go.

## 0. Test build first

Before anything else is built, run a minimal dev build on the user's iPhone
(`npx expo run:ios --device`), signed with their Apple ID, containing one Live Activity and the
widget. It answers:
1. Can the signing team register the App Group (`group.com.abhishek.drivesense.v2`)? Free Apple IDs
   may not be able to. If not, the widget is dropped from scope. The Live Activity's data travels
   through ActivityKit content state, but `expo-widgets` may still insist on the group, so record
   what actually happens.
2. Does the Live Activity appear on the CarPlay Dashboard (the car, or the Xcode Simulator's
   I/O → External Displays → CarPlay window)? If CarPlay needs a layout that `expo-widgets`
   doesn't expose, record that. CarPlay then falls back to the banner layout.

The results are written into this spec under "Test build results" before Task 1 of the plan starts.

## 1. Setup

- `npx expo install expo-widgets`.
- `app.json` plugin entry:

```json
["expo-widgets", {
  "groupIdentifier": "group.com.abhishek.drivesense.v2",
  "frequentUpdates": true,
  "widgets": [{
    "name": "DriveWeek",
    "displayName": "DriveSense week",
    "description": "This week's driving and your last drive.",
    "ios": {"supportedFamilies": ["systemSmall", "systemMedium"]}
  }]
}]
```

- The Live Activity has no `widgets[]` entry. The docs say an entry without families fails to build.
- **Platform split:** `src/widgets/*.ios.ts(x)` holds the real implementation. A matching `.ts`
  file exports no-op stubs for Android, web and Jest. Expo Go on iOS also lacks the native module,
  so the iOS implementation checks the module exists and does nothing when it doesn't.

## 2. Live Activity: `src/widgets/DriveActivity.ios.tsx`

`createLiveActivity('DriveActivity', component)` takes props:

```ts
interface DriveActivityProps {
  state: 'recording' | 'paused' | 'saved';
  time: string;      // "23 min", "1 h 05"
  distance: string;  // "12.4 km"
  avgSpeed: string;  // "42 km/h", or "–"
  score: string;     // "92", or "–"
  events: string;    // "2 events" (saved state only, otherwise "")
}
```

Regions:
- **banner** (lock screen and notification): a "● Recording drive" or "Paused" row; then time,
  distance and average speed in large type; a score ring on the right.
- **compactLeading:** ● plus the time. **compactTrailing:** the distance. **minimal:** ●.
- **expanded** (Dynamic Island, long press): the same content as the banner.
- **saved state:** "Drive saved ✓", then "distance · score", then "time · events".
- The accent orange comes from `#FF6D00`. Widget code cannot import, so the value is written
  inline in the widget file. The token-contract test only scans `src/components` and `src/app`,
  and `src/widgets` is outside both.
- Tapping it opens the `drivesensev2://drive` URL, passed to `start(props, url)`.

## 3. Live Activity sync: `src/widgets/driveActivitySync.ts`

- `driveActivityProps(state, units, now): DriveActivityProps` is a pure function. It builds the
  props from the recording store state using the existing `elapsedSeconds` and `avgSpeedMps`
  helpers and the units formatter.
- `shouldPush(prev, next, lastPushAt, now): boolean` is pure: it returns true when `state`, `time`,
  `distance` or `score` changed and at least 5 s have passed since the last push. A change of
  `state` always pushes.
- `startDriveActivitySync()` is called once from the root layout and subscribes to `useRecordingStore`:
  - `ready` → `recording`: `DriveActivity.start(props, 'drivesensev2://drive')`.
  - While recording or paused: `instance.update(props)` whenever `shouldPush` allows.
  - → `ready` (drive ended): `instance.end(after(now + 15 min), savedProps)`, with the final
    distance, score and event count from the finished drive.
  - A ready → ready re-render does nothing.
- **Relaunch:** on start-up, `DriveActivity.getInstances()`:
  - if a recording was restored, it adopts the first instance;
  - otherwise it ends every instance immediately (orphans left behind by a crash).
- **Background:** during a drive the background location task keeps the JS runtime alive and
  feeds `recordingStore`, so the subscription keeps updating the Live Activity.
- **Failures** are caught and logged with `console.warn`. They never break recording.

## 4. Widget: `src/widgets/DriveWeekWidget.ios.tsx` and `src/widgets/weekWidgetSync.ts`

`createWidget('DriveWeek', component)` takes props:

```ts
interface DriveWeekProps {
  signedIn: boolean;
  distance: string;     // "84"
  unit: string;         // "km" | "mi"
  drives: string;       // "6 drives"
  score: string;        // "88", or "–"
  bars: number[];       // 7 values 0–1, Monday first
  today: number;        // 0–6 index into bars
  last: {route: string; detail: string} | null;  // "Office → Home", "12.4 km · 92 · 2 h ago"
}
```

- **Small:** the week distance in large type with its unit; "6 drives · Score 88"; a 7-bar strip with
  today in orange.
- **Medium:** the small layout on the left and the last drive on the right ("Last drive", route, detail).
- **Signed out:** "Sign in to DriveSense".
- The family comes from the widget's environment.
- `weekWidgetProps(overview, lastTrip, units, now): DriveWeekProps` is pure. It uses the summary
  and daily trend from `/stats/overview?period=week`, plus the dashboard's last trip.
- `refreshWeekWidget()` fetches both, calls `DriveWeek.updateSnapshot(props)`, and swallows errors.
  It is called after a drive is saved (the trip-upload success path), when the app comes to the
  foreground (`AppState` → `active`, at most once per 5 min), and when the unit preference changes.
- On sign-out, `DriveWeek.updateSnapshot({signedIn: false, …})`.

## 5. Testing

- Jest:
  - `driveActivityProps`: recording, paused, saved, imperial units, and missing average speed or score.
  - `shouldPush`: throttling and state changes.
  - `weekWidgetProps`: bar normalisation, today index, missing last trip, signed-out state.
  - The sync controller with a mocked `DriveActivity`: start, update and end in order; orphan cleanup.
- Device: the lock screen banner, the Dynamic Island, the widget in small and medium, and CarPlay.
- `npx tsc --noEmit`, `npx expo lint`, `npm test`.

## Out of scope

- A full CarPlay app (CarPlay templates and the Driving Task entitlement).
- Push-driven (APNs) Live Activity updates.
- An Android ongoing-notification equivalent.
- A speed-alert state on the Live Activity.

## Test build results

(Filled in after section 0.)
