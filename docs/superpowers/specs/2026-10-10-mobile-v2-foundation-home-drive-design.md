# Mobile v2: Foundation, Home, Drive

Date: 2026-10-10. Status: design approved in brainstorming, awaiting spec review.
Mockups: `.superpowers/brainstorm/52482-1791583131/content/` (`home-layout-v12.html`, `drive-layout-v3.html`, `drive-gauge-v9.html`). Local only; not committed. Light mode reference: the Rovy light-mode Home screenshot shared on 2026-10-10.

## 1. Goal and scope

Redesign the DriveSense mobile app. Look and shell follow **Rovy** (orange, glass, in Dark and Light). Stats depth follows **Odo** (many metrics, a round gauge, user-chosen stats).

**Where it is built:** a new app, `drive-sense-v2/`, beside `mobile-expo/`. It runs **Expo SDK 57** (React Native 0.86, React 19.2, TypeScript 6), upgraded from 54 on 2026-10-10 because current Expo Go only loads SDK 57; code and the backend contract carry over from `mobile-expo` (SDK 54). On SDK 56+ React Navigation types come from `expo-router/*` entry points (e.g. `expo-router/js-tabs`), never `@react-navigation/*`. Navigation uses **Expo Router** (routes in `src/app/`), as the new app's `AGENTS.md` requires. `mobile-expo/` is not modified and keeps shipping until v2 replaces it. App identity: name "DriveSense", bundle and package `com.abhishek.drivesense.v2`, so both apps install side by side.

This spec covers the first three sub-projects, because everything later depends on them:

1. **Foundation:** token-based theme with Dark and Light palettes, Nunito at heavier weights, glass tab bar, new tab shell, settings entry point.
2. **Home** (the stats screen).
3. **Drive** (live recording, Map and Gauge modes, customization, summary).

The backend work these screens need is included.

**Also in scope, because a new app needs them to talk to the backend:** the API client (bearer token, 401 handling, `getApiErrorMessage`), and Login and Register screens, ported from `mobile-expo` and styled with the v2 tokens.

**Out of scope** (each gets its own spec later):
- **Logbook** (trip list and trip detail) and **Garage:** their v2 designs come later. Until then their tabs show a minimal token-styled list of trips and vehicles from the existing endpoints (see open question in section 11).
- **All stats page:** and its range chip (7D / 30D / All). The Home "All stats" button is **not rendered** until that page ships, so there is no dead tap.
- **Leaderboard tab:** and the friends backend. The tab bar has 4 tabs until then.
- **Settings and Profile redesign:** only the entry point and the Appearance picker (section 3) change. Auth and onboarding are only re-skinned.
- **User-selectable primary colour:** planned for later. This spec only requires that the token layer can support it (section 3).
- **Pro / paywall banner and the points ring on the weather card** seen in the Rovy light screenshot: not built (no paywall, no conditions score).

## 2. Information architecture

Tabs, left to right: **Home · Logbook · Drive · Garage**, in a floating glass pill bar (Drive is the centre, active tab marked by a dark inset pill with an orange glyph).

| Today | v2 |
|---|---|
| Home (Dashboard) | **Home** |
| Trips | **Logbook** |
| Live | **Drive** |
| Garage | **Garage** |
| Profile tab + slide-out sidebar | Gone. A **gear icon on every tab header** opens a Settings stack (profile, vehicle preferences, about, sign out) pushed over the tabs |

Route layout: `src/app/(auth)/` for login and register, `src/app/(tabs)/_layout.tsx` with the custom glass tab bar and `index` (Home), `logbook`, `drive`, `garage`; `src/app/settings/` as a stack; `src/app/trip-summary.tsx` as a full-screen modal.

**Recording persists across tabs.** While a trip is recording or paused, a mini banner (speed, elapsed time, distance) sits above the tab bar on every tab except Drive. Tapping it opens Drive. The recording session lives in a store above the router from day one, so the Drive screen and the banner read the same state. The native tracking logic (`useLiveTracking.native.ts`, `backgroundLocationTask.ts`) is ported into that store with its tests, not rewritten.

## 3. Theme foundation

v2 ships **Dark and Light**. Settings has an **Appearance** picker: **System** (default, follows the phone) / **Light** / **Dark**, persisted in AsyncStorage. The resolved scheme drives the status bar style and `app.json` uses `userInterfaceStyle: "automatic"`.

**Required by the theming feature:** components never use a raw colour. They read semantic tokens through `useAppTheme()`, and the theme is built from `{palette, accent}` so a different accent can be supplied later without touching components. v2 ships two palettes (dark, light) and one accent.

### Colour tokens

| Token | Dark | Light | Use |
|---|---|---|---|
| `canvas` | `#000000` | `#F5F5F4` | all screens (Light: soft neutral off-white, changed 2026-10-11) |
| `card` | `#1C1C1E` | `#FFFFFF` | tiles, rows (Light cards get a soft shadow instead of contrast) |
| `control` | `#1F1F1F` | `#FFFFFF` | pills, chips, gear button, segmented track |
| `controlActive` | `#0A0A0A` | `#E5E5EA` | active tab pill |
| `accent` | `#FF6D00` | `#FF6D00` | hero fill, icons, orange text |
| ~~`accentAction`~~ | — | — | Removed 2026-10-13: every filled primary button (Sign in included) uses `accent` `#FF6D00`. White on it is about 2.8:1, so button labels stay large and black-weight; never put small white text on `accent`. |
| `accentTint` | `#2A1305` | `#FFE9D9` | tinted summary tile |
| `textPrimary` / `textSecondary` / `textTertiary` | `#FFFFFF` / `#A1A0A5` / `#5E5E60` | `#000000` / `#6E6E73` / `#AEAEB2` | |
| `blue` `cyan` `mint` `teal` `purple` `green` `red` | `#0091FF` `#3AD3FD` `#00DDC2` `#00D4E4` `#DD32F4` `#2BD35A` `#FF3E45` | `#0088FF` `#00C0E8` `#00C8B3` `#00C3D0` `#CB30E0` `#34C759` `#FF383C` | icons and units; iOS 26 system colours |
| `weatherCard` | sky gradient by weather code and day/night (`utils/weatherSky.ts`) | same | clear day light-to-mid sky blue, cloud greys it, rain dark blue, storm near-black, night navy; kept deep enough for white text (changed 2026-10-11) |
| `glass` | iOS 26: native Liquid Glass (`regular`). Fallback: blur + 28% dark fill + 1px light border | iOS 26: native Liquid Glass. Fallback: blur + 30% white fill + 1px white border | tab bar, map sheet, map chips, Drive sheets (Customize, vehicle picker: floating, inset 8, radius 34, over a `scrim`; rows inside use the translucent `glassRow`) |

A unit test checks each palette defines every token.

Every card has a very soft shadow in both modes (radius 18, y 6; opacity 0.07 Light, 0.35 Dark). Tab screens use `StickyHeaderScroll`: the "My / Title" header and gear stay pinned while content scrolls under a progressive blur and a fade to the canvas colour. The weather card shows a pulsing skeleton on first load. The selected tab is a clear Liquid Glass lens with a faint accent tint, and the bar reacts to touch (iOS 26).

### Type (Nunito)

| Style | Weight | Size |
|---|---|---|
| Hero number | Black 900 | 46 |
| Weather temperature | Black 900 | 58 |
| Page title (two-line, "My / Stats") | ExtraBold 800 | 38 |
| Tile value | ExtraBold 800 | 20 |
| Label | Bold 700 | 12 |
| Unit | SemiBold 600 | 11 to 12, secondary text colour |

The root layout loads Nunito 600, 700, 800 and 900 (`@expo-google-fonts/nunito`) and holds the splash screen until they are ready.

### Shape and spacing

- Radius: cards 24, hero 26, pills fully round.
- Gap between cards 6; gap under the weather card 26.
- Tile: min-height 66, vertical padding 8, content vertically centred, icon vertically centred at the right edge.
- Glass tab bar: 64 tall, 26 px icons, equal-width tab slots. The active indicator is one pill that springs to the selected tab and stretches (up to 1.28× wide) while it travels, iOS 26 style; its travel is clamped to the first and last tab. The pill is also draggable: a horizontal drag moves it under the finger and release snaps to the nearest tab and opens it; taps still work.
- Scroll content bottom inset = measured tab bar height + its bottom offset + safe-area inset. Never a hard-coded number (an earlier mockup had the last button hidden behind the bar).

## 4. Home

Top to bottom, one scrolling column. Gear icon top-right; two-line title "My / Stats".

1. **Weather card** (section 4.1).
2. **Hero tile (orange):** Top Speed, value and unit only, spanning two rows, with a faint decorative gauge arc behind the value (white, low opacity; not data-driven). Beside it, stacked: **Total km**, **Streak** (days).
3. **Tile grid (2 columns):** Avg Speed · Driving Score (with a ▲/▼ delta) · Trips · Drive Time · Max G-Force · Avg Trip distance.
4. **Turns** (left/right split bar with counts) and **Events** (Accel, Brake counts) side by side.
5. **Altitude** (Highest, Lowest).
6. **Distance trend** chart (existing `/dashboard/trend`, day granularity).
7. **Last trip** card (route addresses, vehicle, distance, time, top speed). Taps through to trip detail.
8. "All stats →" button: hidden until the All stats page exists.

Values that have no data render as "–", never "0".

### 4.1 Weather card

Shows city, temperature, condition, high/low and one status tag (for example "Good conditions for driving"). No humidity, wind or visibility.

- Source: Open-Meteo (no API key), called from the phone. Coordinates are rounded to 2 decimals (about 1 km) before sending. City name from the platform reverse geocoder.
- The status tag is a pure function of weather code, visibility and wind, with three tones (good / take care / poor). The rule table lives in code with unit tests.
- Cached for 30 minutes. If location permission is denied, or the fetch fails, the card is hidden. Home must not block on weather.

### 4.2 Home data

New `GET /dashboard/home?tz=<IANA zone>`, authenticated, all-time unless stated. Until it is deployed the client treats its 404 as "not shipped" and fills only the totals `/dashboard` already returns (total km, trips, drive time, avg trip, score without delta, events); every other field stays "–". Existing `/dashboard` and `/dashboard/trend` keep serving the trend chart and the last trip.

| Field | Definition |
|---|---|
| `top_speed_mps` | `MAX(Trip.max_speed_mps)`, treating stored `0` as missing; null when no trip has a speed |
| `total_distance_meters` | sum over non-deleted ended trips |
| `streak_days` | consecutive local-calendar days (per `tz`) with at least one ended trip. Alive if the latest drive day is today or yesterday |
| `avg_speed_mps` | `sum(distance) / sum(duration - idle)`, never a mean of per-trip means; null when there is no moving time |
| `score` | `{current, delta}`: average driving score over the last 7 days, and its difference from the prior 7 days. `delta` is null unless both windows have scored trips |
| `trip_count`, `drive_time_seconds` | sums |
| `avg_trip_distance_meters` | distance divided by trips; null when no trips |
| `max_g` | `{value, estimated}` from `Trip.max_g_force`; null when no trip has data. `estimated` is true when the maximum came from a GPS-derived trip |
| `turns` | `{left, right}` sums of per-trip counts |
| `events` | `{accel, brake}` counts (all-time, from `Event`) |
| `altitude` | `{highest_m, lowest_m}` from per-trip extremes; null when none recorded |

## 5. Drive

One screen with a **Map | Gauge** toggle and a **tune** button (top-right). Everything below applies to both modes unless stated.

### 5.1 States

| State | Top-left | Primary control |
|---|---|---|
| **Ready** | vehicle chip (picks the car, name never truncated at normal lengths) | **Start Drive** (`accent`, the Home hero orange, 18 px Black label; decided 2026-10-10 to match Home, accepting about 2.8:1 white-on-orange contrast), plus a status line "Auto-start on, begins above 8 km/h" |
| **Recording** | timer pill with a green "Recording" dot | **Pause** |
| **Paused** | timer pill with an amber "Paused" dot | **Resume** and **End** |
| **Summary** | full page, no tab bar | **Save** (`accent`), Share, and **Discard** top-left |

- **Auto-start** is today's behaviour (2.2 m/s) and is shown, not hidden. Auto-end after 180 s idle with a stable GPS cluster is unchanged. Both go through the same Summary.
- **End** exists only inside Paused, so a stray tap cannot end a live trip.
- While a drive is recording or paused, the Drive tab hides the tab bar (it slides down off screen) and the sheet drops into its space; both return at Ready. The mini banner still covers other tabs.
- Primary buttons animate: each fades and springs in when it appears (Pause rises in; on Pause, Resume slides in from the left and End from the right) and springs down while pressed.
- Events (rapid acceleration, harsh brake, overspeed) show as a short toast under the top bar.
- Sprint mode (a Rovy feature) is not built: there is no 0-100 data.

### 5.2 Map mode

Full-screen map in the existing dark map style, an orange route line drawn live, and the position dot with an accuracy circle. The map always follows the car: it opens at street level (zoom 16.8, about 900 m camera altitude on Apple Maps) and the user cannot pan, rotate or tilt it (pinch zoom still works). While recording or paused the camera tilts to 55° for a 3D driving view, with buildings shown; Ready is flat. The recorder ignores any GPS step implying more than 70 m/s, so a location jump is not counted as distance. A glass sheet with a **semicircular bump** on its top edge, Rovy style. Sheet and bump are one continuous shape (one outline, no seam): bump radius 90, rising 82 above the sheet (almost a full half-circle), joined to the sheet's top edge by 16 px concave fillets (made taller than the v9 mockup's 66 / 46 on 2026-10-10). A speed arc (radius 72, unchanged, leaving glass above and around it, faint track, `accent` fill, 180° sweep, value over the speed scale) sits inside the bump with the speed (58 px Black, km/h) centred under it. On iOS 26 the sheet is Liquid Glass: `regular` in Dark, `clear` in Light (regular frosts the pale light map to near-white).

- **Ready:** no stats. The sheet holds only the bump speed, **Start Drive** and the auto-start line, so it is shorter.
- **Recording / Paused:** the sheet grows to add four stats (the first four chosen stats; value 20 px, label 11 px, icon 16 px) between the speed and the primary control.

Shape maths (bump path for a given sheet width and height) is a pure, unit-tested function.

### 5.3 Gauge mode

`canvas` with a faint orange glow, a dial (230 px), a 3 × 2 grid of stat tiles and the primary control. In **Ready** the stat grid is hidden: only the dial (at 0) and Start Drive, directly under it. Dial styles: **Arc** (default), **Classic** (needle and numbers), **Digital** (big number and segment bar), **Minimal** (thin ring). All are drawn with `react-native-svg` (a new dependency; `mobile-expo` does not use it). The angle and fill maths are a pure, unit-tested function (270° sweep from 135°, value clamped to the scale).

### 5.4 Customize sheet (tune button)

- Gauge style (4), accent colour (6 swatches), speed scale (Auto, 120, 200, 300).
- Stats: choose 6 from: distance, time, avg speed, top speed, max G, live G, altitude, elevation gain, heading, events, live score, smoothness, GPS accuracy. Order is the display order. Gauge mode shows all 6; Map mode shows the first 4.
- Stored locally (AsyncStorage through a Zustand store, same pattern as `vehiclePreferencesStore`). No backend. Default: distance, avg speed, top speed, smoothness, max G, heading (smoothness is fourth so it shows on the map sheet).
- The accent swatch here is a Drive-screen setting for the gauge only; the app-wide theme accent is the later theming feature.

### 5.5 Live stat definitions (computed on the phone)

Distance, time (excludes paused time), avg speed (distance over moving time), top speed, altitude, elevation gain (sum of positive altitude deltas after smoothing), heading, event count, current and max G, and a live score estimate. The live score must use the same weights as `driving_score_service.py`; a test pins the client constants to the backend values so they cannot drift.

### 5.5b Brought over from the old Live tab (2026-10-10)

- **Smoothness:** live Smooth / Moderate / Harsh from the accelerometer (`expo-sensors`, 10 Hz, peak of each 300 ms window, only while recording). Gravity is removed from the total reading, and the bands use the event thresholds (3.0 and 3.5 m/s²). The same feed gives Live G and Max G. Web and the iOS Simulator have no accelerometer, so these show "–" there.
- **GPS accuracy:** ± metres of the current fix.
- **Compass and elevation (Map mode):** under the tune button, a glass compass whose N always points at true north (it turns as the 3D map turns), with the heading ("270° W", "–" when stopped) and an elevation chip.
- **2D / 3D switch:** a pill beside Map/Gauge during a live drive in Map mode; saved with the drive settings.
- **Moving / Idle:** the timer pill's dot and label: green Moving (≥ 0.8 m/s), grey Idle, amber Paused.
- **Direction:** ported from the old tracking: GPS course when moving at 1 m/s or more, otherwise the bearing between fixes once the car has moved more than 4 m, blended 42% per reading, held when stopped. The Heading stat shows degrees plus a 16-point compass ("212° SSW"), and "–" when stopped. The car is drawn as an arrow (a dot until the heading is known). In the tilted live view the camera turns to the direction of travel and centres 36 m ahead; it re-aims only after 3 m of movement or an 8° turn. Ready stays north-up.

### 5.6 Recording, sync and end of trip (tracking port, 2026-10-10)

Ported from mobile-expo's `useLiveTracking.native.ts` + `backgroundLocationTask.ts`, behind `recordingStore`:

1. **Start:** tap Start Drive, or **auto-start** when a Ready fix reaches 2.2 m/s and a vehicle is chosen. The server trip is created at once (`POST /trips/start`, backdated to the real start).
2. **Live upload:** every recorded fix joins a queue (`pending`), sent in batches of 200 every 8 s, on returning to the foreground, and from background wakes (at most every 15 s). A batch is taken off the queue before sending and put back if the send fails, so nothing is sent twice. Offline just leaves points queued (sync state `offline`).
3. **Fix filter (ported):** a fix worse than 55 m accuracy is dropped once there is a previous fix; GPS jumps implying more than 70 m/s are not counted as distance.
4. **Auto-end (ported):** 180 s without movement and the last 4 fixes stopped within 18 m. It goes through the same summary as End.
5. **End** (tap or auto) snapshots the drive, resets Drive to Ready and opens Summary, which immediately sends any remaining points (plus a batch that was in flight at End and failed) and calls `POST /trips/end`. A 404 "No active trip" (the server's 15-minute stale sweep already closed it) counts as saved. **Save** closes the summary, retrying first if finishing failed. **Discard** waits for any save in progress, then calls `DELETE /trips/{id}`. A drive without a vehicle is local only and cannot be saved.
6. **Survives restarts:** the drive in progress (status, timing, stats, route, vehicle, server trip id, upload queue) is saved every 5 s and on every start / pause / end. A finished drive is saved until it is stored. On launch a recording drive whose last fix is more than 60 s old comes back **Paused** at that fix, so the clock does not count the time the app was dead; an unsaved finished drive reopens its summary.
7. **Background:** on a development or store build, an OS background-location task (registered at startup, ported from mobile-expo) feeds the same store while a drive is live. The foreground watcher stands down so there is one stream of fixes. Android shows a foreground-service notification. **Expo Go cannot run background location**, so there tracking is foreground only.
8. Addresses are geocoded by the backend after end and appear in the Logbook, not on Summary.

Summary layout (route `src/app/trip-summary.tsx`, from the Rovy screenshot): Discard pill; "Great Drive!" + "With {vehicle}"; route card fitted to the route bounds (green start, orange end; centred on the car when there is no route); `accentTint` card with Top Speed and Drive Time; Distance and Avg Speed; Share and Save.

## 6. Backend changes

One Alembic migration plus the changes below.

**Schema**
- `trips`: `max_g_force float null`, `max_g_source text null` (`sensor` or `gps`), `left_turns int null`, `right_turns int null`, `max_altitude_m float null`, `min_altitude_m float null`.
- `location_points`: `peak_g float null`.

**Behaviour**
- **Ingestion** (`location_ingestion_service.py`): fill `max_altitude_m` / `min_altitude_m` and `max_g_force` (source `sensor`) per batch, the same way `max_speed_mps` is filled today. Fix `batch_max_speed` so a batch with no speed leaves the trip's `max_speed_mps` NULL instead of coercing to 0.
- **Trip end:** if the trip has no sensor G, derive `max_g_force` from GPS speed changes (source `gps`); compute `left_turns` / `right_turns` from heading changes in a new `turn_detection_service.py` (a turn is a signed heading change of at least 60° within 8 s at moving speed; constants live in one place and are tuned against real trips).
- **Backfill:** a `python -m app.db.backfill_*` script for existing trips, following `backfill_addresses`.
- **Pause and resume:** `POST /trips/{id}/pause` and `/resume` set the existing `paused` and `active` states. `close_stale_trips` skips paused trips, with a 12 hour cap so a forgotten pause cannot stay open forever. Paused time is excluded from the `duration_seconds` the client sends at end.
- **Discard:** `DELETE /trips/{id}`, 204, soft delete through the existing `deleted_at`; owner only (404 otherwise). Built 2026-10-10; a trip that was never ended is also marked ended so it cannot read as ongoing.
- **Home:** `GET /dashboard/home` as in section 4.2, with schemas in `schemas/dashboard.py` and logic in `dashboard_service.py`.

## 7. Mobile structure (`drive-sense-v2/src/`)

Each unit has one job:

- `app/`: routes only (section 2). No logic beyond wiring screens to stores.
- `theme/`: palette + accent in, `AppTheme` out; `useAppTheme()`; dark and light palettes; `appearanceStore` (System / Light / Dark, persisted).
- `components/`: `GlassTabBar`, `BentoTile`, `HeroTile`, `WeatherCard`, `MiniRecordingBanner`, `GaugeDial` (+ `gaugeMath.ts`), `StatSlot`, `CustomizeSheet`, `DriveSheet`, `TripSummary`.
- `stores/` (Zustand, each self-contained with fetch + cache + error): `authStore`, `homeStore`, `recordingStore`, `driveSettingsStore`, `weatherStore`.
- `services/`: `apiClient` (ported), `authService`, `homeService`, `tripService` (start, end, detail, pause, resume, delete, locations, events), `vehicleService`, `weatherService`.
- `tracking/`: the ported native tracking and background-location task, behind the `recordingStore` interface.

**Ported from `mobile-expo`, not redesigned:** API client and error helper, auth calls, trip and vehicle services, event thresholds (`drivingThresholds`), metric formatting, tracking and background task. Each moves with its tests. Nothing else is copied.

**Dependencies, all added with `npx expo install`:** `expo-router`, `@expo-google-fonts/nunito`, `expo-font`, `expo-splash-screen`, `react-native-svg`, `expo-glass-effect` (native iOS 26 Liquid Glass; the Drive bump is a sheet and a circle merged by one `GlassContainer`), `expo-blur` (fallback glass on Android, older iOS; never under a mask, which stops iOS blur rendering; web uses CSS `clip-path`), `expo-linear-gradient` (weather card), `react-native-safe-area-context`, `react-native-screens`, `@react-native-async-storage/async-storage`, `zustand`, `axios`, `expo-location`, `expo-task-manager`, `expo-sensors`, `react-native-maps`. Jest with `jest-expo` and `@testing-library/react-native`, as in `mobile-expo`. Location, background mode and motion permissions move into `app.json` with the same wording as `mobile-expo`.

## 8. Error and empty states

- New user, no trips: every Home value shows "–", including the Top Speed hero, which stays orange.
- Drive Ready never shows stats, so there are no zeroed tiles before a drive.
- Home request fails: keep the last cached data and show an inline retry; never a blank screen.
- Location permission denied: Drive explains it and offers a settings link; weather hides.
- Sensor unavailable or no data: Max G and Live G show "–".
- Pause or discard request fails: keep the trip on screen, show the error through `getApiErrorMessage`, and allow retry.

## 9. Testing

**Backend (unit, no DB where possible):** streak across midnight, DST and a missing today; weighted average speed; top speed with stored 0 and NULL; score delta with an empty window; turn detection on synthetic headings; G aggregation and source flag; pause and resume transitions and stale-sweep exemption and cap; delete authorisation. Integration tests for the new endpoints are marked `@pytest.mark.integration`.

**Mobile (jest):** gauge angle maths; bump path maths; both palettes complete; appearance resolution (System follows device); stat picker (max 6, order persists); null formatting ("–"); weather tag rules; token contract (a test that fails on raw colour literals in `src/components/` and `src/app/`); live-score constants equal the backend's; Summary flow including discard.

**Manual on a device before shipping G-force:** whether motion data arrives during a background-recorded trip. If it does not, background trips fall back to the GPS estimate, and the "≈" prefix on Home Max G covers it.

## 10. Build order

1. Foundation: dependencies, Expo Router shell, dark + light tokens, Appearance picker and fonts, glass tab bar, gear and Settings stack, ported API client, Login and Register.
2. Backend: migration, ingestion changes, `/dashboard/home`, pause/resume, delete, turn detection, backfill.
3. Home.
4. Drive base: port tracking into `recordingStore`, Map mode, mini banner, Ready / Recording / Paused.
5. Gauge mode and Customize.
6. Summary, Save, Discard.
7. Sensor G capture on device.

## 11. Decisions log

New app `drive-sense-v2` on Expo 57 (from 54) with Expo Router; Dark and Light with a System / Light / Dark picker (2026-10-10, reverses the earlier dark-only call); Drive map sheet keeps the Rovy semicircle bump and Ready shows no stats (2026-10-10); faint arc on the Top Speed hero; no Pro banner or weather points ring; Nunito heavier (not SF Rounded); Home = all-time totals with 7-day score delta; weather included; Top Speed hero; four gauge styles; stats user-chosen (6); pause by endpoints; plain End behind Pause; leaderboard friends-only, later; primary colour choice later.

**Open:** what the Logbook and Garage tabs show before their own specs: (a) a minimal token-styled list from existing endpoints (current assumption), or (b) a port of the current `mobile-expo` screens re-skinned with tokens.

## 12. Risks

- Motion capture in background may not work on iOS. Mitigated by the GPS fallback and the device check in section 9.
- Turn-detection thresholds need tuning on real data.
- Porting native tracking and the background-location task is the riskiest step: it is the most sensitive code in the app and only provable on a device. Port it with its tests, unchanged in behaviour, before building UI on it.
- Weather adds a third-party call carrying coarse location. Mitigated by rounding, caching and hiding on failure.

## 13. Implementation status (2026-10-10)

Built in `drive-sense-v2/` (mobile only; backend untouched):

- **Foundation:** Expo Router shell (`(auth)`, `(tabs)`, `settings`), dark + light palettes with the System / Light / Dark picker, Nunito 600–900, glass tab bar with the mini recording banner, gear → Settings, ported API client, Login and Register.
- **Home:** every section in 4, wired to `/dashboard`, `/dashboard/trend` and `/dashboard/home` (with the fallback in 4.2); weather from Open-Meteo.
- **Drive:** Map mode with the bump sheet, Gauge mode (four styles), Customize sheet, Ready / Recording / Paused, event toasts, vehicle picker.
- **Interim Logbook and Garage:** option (a) from section 11.
- **Tests:** 89 jest tests (gauge and bump maths, palettes, appearance, token contract, stat picker, recording state machine, weather rules, Home fallback, ported API errors).

**Built 2026-10-11:** `GET /dashboard/home` (all fields except `turns`; altitude from stored points, ignoring exact 0.0 which means "no fix"); G-force storage (migration `20261011_0004`: `location_points.peak_g`, `trips.max_g_force`, `trips.max_g_source`). The phone attaches the peak motion-sensor G since the previous fix to each uploaded point; ingestion keeps the trip maximum (`sensor`); a trip that ends without sensor data gets an estimate from GPS speed changes (`gps`, fixes 0.5–5 s apart, under 1.5 g, at least 0.02 g). Backfill: `python -m app.db.backfill_g_force` (trips with no usable pairs are marked `gps-none`). Summary shows Max G (server value, "≈" for estimates; phone value until loaded).

**Also built 2026-10-11:** turn detection (`turn_detection_service.py`: signed heading change ≥ 60° within 8 s above 3 m/s; GPS course, else bearing between fixes ≥ 4 m apart; gaps over 5 s break the window), stored as `trips.left_turns` / `right_turns` (migration `20261011_0005`) when a trip closes; `/dashboard/home` returns their sums. `python -m app.db.backfill_trip_metrics` computes turns (and the GPS G estimate) for older trips. Phone: average speed uses moving time (gaps ≤ 5 s while moving); a speed reading implying more than 9 m/s² from the last trusted reading never becomes the top speed; live score = the server formula (100 − 2 × brakes − 1.5 × accels − 0.1 × Σ overspeed intensity, floored, clamped), with a test that reads the backend weights.

**Not yet built:** rest of backend section 6 ( `/dashboard/home`, pause/resume endpoints, turns, peak G capture, backfill); live score (shown as "–"). Background recording is built but only runs on a dev or store build, which has not been made yet.

