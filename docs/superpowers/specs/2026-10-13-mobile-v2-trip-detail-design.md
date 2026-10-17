# DriveSense v2 — Trip Detail page

Date: 2026-10-13
Status: approved in brainstorm, awaiting spec review
App: `drive-sense-v2/` (Expo SDK 57). Builds on `2026-10-10-mobile-v2-foundation-home-drive-design.md`.

## Goal

Tapping a trip in Logbook opens a full trip page: Rovy's look (light cards, big numbers, orange) with Odo's depth (speed, time-at-speed, elevation, stops). The post-drive summary (`app/trip-summary.tsx`) stays a separate, short screen with Save / Discard; it is not changed by this work.

## Decisions

| Topic | Decision |
|---|---|
| Summary vs detail | Two screens. Summary stays short; Logbook opens the new detail page. |
| Route on map | Polyline coloured by speed on a continuous scale; start/end flags; event markers; legend chip. |
| Fullscreen map | Expand button opens it; has a Speed / Plain toggle. The in-page map card is always speed-coloured. |
| Style | Rovy look + Odo depth, reusing v2 cards, tiles, hero split and tokens. |
| Actions | `⋯` menu in the header: Share, Change vehicle, Delete. No bottom action bar. |
| Data | One request, `GET /api/v1/trips/{id}`. All analysis computed on the phone from `location_points`. |
| Backend | One addition: `PATCH /api/v1/trips/{id}` to change the vehicle. |

Out of scope (later): replay drive, weather at trip time, G-force chart (sensor data only exists for new trips), Maps-estimate comparison, speed-limit violations (no limit data), distance by hour, friends.

## Page layout (top to bottom)

1. **Header** (glass, like other v2 screens): back circle · title = start place (or "Drive") with date + start time underneath · `⋯` circle.
2. **Map card**, 260pt, radius = card radius. Speed-coloured route, start flag (green) and end flag (accent), event markers (existing `EventMarker`), expand button top-right, legend chip bottom-left (`0 ▬▬ 100+ km/h` gradient). Map is static (no pan/zoom) in the card.
3. **Place card**: start address + start time, end address + end time, Day/Night chip.
4. **Hero split** (accentTint, as in the summary): Top speed km/h · Drive time.
5. **Stat tiles**, 2 columns, Home tile style: Distance · Avg speed (moving) · Stops · Idle time · Elevation gain · Turns L/R · Max G (`≈` when GPS-estimated) · Moving time. A tile with no value is hidden; tiles reflow.
6. **Score & events**: reuse `ScoreEventsCard`, plus up to 3 server insights (title + message, tone colour).
7. **Speed** section: speed-over-time area chart, stroke coloured with the same speed scale, peak marker with value.
8. **Time at speed**: horizontal bars for 0–20, 20–40, 40–60, 60–80, 80–100, 100+ km/h, each with duration and % of moving time. Empty bands hidden.
9. **Elevation**: profile chart, ↑ gain, ↓ loss, highest / lowest.
10. **Stops**: first 3 stops (time + duration), "Show all N" expands in place. Tapping a stop opens the fullscreen map centred on it.

Sections with no data hide entirely (no altitude → no Elevation; no stops → no Stops; no points → map shows "No route recorded" and charts are hidden).

## Speed colour scale

Continuous, built from existing palette tokens so it works in both appearances:

| km/h | 0 | 25 | 50 | 75 | 100+ |
|---|---|---|---|---|---|
| token | cyan | green | amber | accent | red |

Colours between stops are interpolated in RGB. One helper, `speedColor(kmh, theme)`, is used by the map, the legend and the speed chart.

## Analysis helpers — `src/utils/tripAnalysis/`

Pure functions over `TripPoint[]` (`recorded_at`, lat/lng, `speed_mps`, `altitude_m`), each with Jest tests.

| Function | Output | Rules |
|---|---|---|
| `cleanSpeeds(points)` | speed per point (m/s) | GPS `speed_mps` when present, else distance/Δt; reject readings needing > 9 m/s² from the last trusted speed (same rule as `recordingStore`). |
| `speedSegments(points, theme)` | `{coords, color}[]` for polylines | Consecutive points grouped while their colour stays within a small step; ≤ 500 points drawn (even thinning, endpoints kept). |
| `speedSeries(points)` | `{t, kmh}[]` | ≤ 200 samples for the chart; peak kept. |
| `timeAtSpeed(points)` | per band: seconds, metres, share of moving time | Uses segment speed (below). Stopped segments (< 5 km/h) are not in any band. |
| `tripTimes(points)` | moving s, idle s | Moving = segment speed ≥ 5 km/h. |
| `elevationProfile(points)` | series, gain, loss, max, min | Ignore null and exact 0.0 altitude (as Home); gain/loss count only changes ≥ 3 m (hysteresis) to drop GPS jitter. Hidden if < 2 valid points. |
| `detectStops(points)` | `{start, durationS, lat, lng}[]` | Speed < 5 km/h for ≥ 30 s; first and last stretch of the trip are not stops. |
| `dayPeriod(startIso)` | `'day' \| 'night'` | Night = local hour < 6 or ≥ 19. |

**Segment speed.** Each pair of consecutive points is a segment. Background GPS only reports after 2 m of movement, so a car standing still produces a long gap with no points. Segment speed is therefore the first point's clean speed when the gap is ≤ 5 s, and distance ÷ time across the gap when it is longer (a long gap at a red light reads as stopped, a GPS dropout on a highway reads as moving). Gaps over 10 minutes (a paused drive) are ignored entirely.

The server's `idle_time_seconds`, `max_speed_mps`, `left_turns`/`right_turns`, `max_g_force`, `driving_score`, `events`, `insights` are used as-is when present; phone-derived values fill gaps (e.g. top speed falls back to the clean series peak).

## Components and files

New:
- `src/app/trip/[id].tsx` — the page (registered in root `_layout.tsx` as a pushed card screen, tab bar hidden).
- `src/stores/tripDetailStore.ts` — `load(id)`, `detail`, `status: 'loading' | 'ready' | 'error'`, `error`, `remove()`, `changeVehicle(vehicleId)`. Cache keyed by id so going back and forth does not refetch.
- `src/components/trip/TripRouteMap.native.tsx` (+ `.web.tsx` placeholder) — speed polylines over a faint wide underlay, flags, event markers, legend chip, expand button.
- `src/components/trip/RouteFullscreen.tsx` — modal map, pan/zoom on, Speed / Plain toggle, optional focus coordinate (for stops).
- `src/components/trip/PlaceCard.tsx`, `SpeedChart.tsx`, `TimeAtSpeedCard.tsx`, `ElevationCard.tsx`, `StopsCard.tsx`, `InsightsList.tsx`, `TripDetailSkeleton.tsx`.
- `src/utils/tripAnalysis/*` + tests; `src/utils/speedColor.ts` + test.

Changed:
- `src/app/(tabs)/logbook.tsx` — cards become pressable → `router.push('/trip/' + id)`; refresh list on focus (already) so deletes / vehicle changes show.
- `src/services/tripService.ts` — `TripDetail` gains `location_points`, `insights`, addresses, times, distance, duration, speeds, turns, vehicle; add `tripDetailApi.updateVehicle(id, vehicleId)`.
- Reuse: hero `Split` (extract from `trip-summary.tsx` into `components/summary/Split.tsx`), Home tile, `ScoreEventsCard`, `EventMarker`, `VehiclePickerSheet`, `routeRegion`.

Charts are hand-drawn with `react-native-svg` like `TrendChart` (no chart library).

## ⋯ menu

- **Share** — text summary (distance, time, top speed, score) via `Share.share`.
- **Change vehicle** — opens `VehiclePickerSheet`; on pick calls `PATCH`; header/tiles update; Logbook refreshes on return.
- **Delete** — confirm dialog ("Delete this drive? This can't be undone."), calls existing `DELETE /trips/{id}`, pops back to Logbook.

## Backend

`PATCH /api/v1/trips/{trip_id}` with body `{vehicle_id}`:
- Trip must belong to the user and not be deleted (404 otherwise).
- Vehicle must belong to the user (404 otherwise).
- Returns `TripRead`. Service function `update_trip_vehicle` in `trip_service.py`.
- Unit test in `tests/unit/` alongside `test_trip_delete.py`; route added to `test_app_routes`.

Production does not yet have this or the earlier 2026-10-11 backend work; deploying needs the user's go-ahead. Until then, Change vehicle shows the API error message on the phone.

## States and errors

- Loading: `TripDetailSkeleton` (map block + tiles shimmer, like `WeatherSkeleton`).
- Error: card with message from `getApiErrorMessage` and Retry.
- 404 (trip deleted elsewhere): "This drive no longer exists" + back.
- Delete / change-vehicle failures: inline error under the header; page stays.

## Testing

- Jest: every `tripAnalysis` function (empty input, single point, gaps, spikes, null altitude, stop at start/end), `speedColor` interpolation and clamping, `tripDetailStore` (load, cache, remove, changeVehicle, error) with the shared `mockApiClient`.
- Theme contract test keeps passing (no raw colours in components).
- Backend: unit tests for `PATCH` (owner check, foreign vehicle, deleted trip, success).
- Simulator check against the local API: open a recorded trip from Logbook, see the speed-coloured route, charts, stops; Change vehicle; Delete.

## Addendum 2026-10-13 — more from the Rovy / Odo screenshots

Requested after the first build: G-force, a Drive Analysis section, Odo's climb & descent, time at speed and acceleration & braking.

Page order is now: map · place · hero · tiles · **Score** (ring + verdict + insights) · **Acceleration & braking** · **Drive Analysis** heading (icon square, as in Rovy) over Speed · Time at speed · G-Force · Climb & descent · Stops.

- **Acceleration & braking** (`EventsCard`): three tiles (Acceleration, Braking, Speeding) with counts and "N hard"; then each event (icon, kind, "1.4× the limit", time), first 3 with "Show all N events". Tapping an event with a location opens the full-screen map centred on it. Event markers stay on the route map. The score card on this page hides its own event counts (`showEvents={false}`) so they are not shown twice; the post-drive summary is unchanged.
  - Hard = intensity ≥ 1.3, where intensity is the reading ÷ the event threshold (server `driving_event_detection_service`).
  - Older records and the demo seed use `brake` / `accel` and store overspeed intensity as a raw speed; `eventKind` maps the old names, and `eventRatio` only treats 0 < intensity < 10 as a ratio. Applies everywhere events are counted.
- **G-Force** (`gForceSeries`, `GForceCard`): forward G from GPS speed change between fixes ≤ 5 s apart, |g| ≤ 1.5 (the server's cap); chart centred on 0, speeding up shaded green above, braking red below, at least ±0.3 g shown; peak acceleration and peak braking with times. When the trip has a phone-sensor Max G it is shown under the chart ("includes cornering"). Works for every trip with dense GPS, not only sensor trips.
- **Climb & descent** (`ElevationCard`): adds Climbing / Descending / Flat time. Judged over 30 s windows; grade under 1 % or a window under 50 m is flat.
- **Time at speed**: Time / Distance switch.

## Addendum 2 — 2026-10-13

- **Map events:** an **Events** pill on the map card and the full-screen map shows / hides the event markers (on by default). Tapping a marker opens its callout: name (· hard) and time · "N× the limit".
- **Rovy summary cards** under the tiles: [Moving time tile | Altitude card] row, then **Turns** full width (Home's `TurnsCard`), then a **G-Force** card (highest G, acceleration and braking peaks). The Turns and Max G tiles are removed from the tile grid, and the Climb tile too (covered by Altitude and Climb & descent).
  - The G-Force card uses the phone-sensor Max G when the trip has one, otherwise the same GPS figures as the G-Force chart (marked ≈), so the two never disagree.
- **Acceleration & braking:** totals only; "Tap to see all N events" opens the full list in place ("Hide events" closes it).
- **Climb & descent** is always shown for trips with a route; without altitude it says so instead of disappearing.
- **Distance over time** (Odo's "Distance by hour"): bars per clock-aligned bucket — 1 min up to 15 min, 5 min up to 1 h, 15 min up to 3 h, then hourly (titled "Distance by hour"). Peak bar highlighted; total and peak shown.
- **Backend fix:** `GET /trips/{id}` was not returning `max_g_force`, `max_g_source`, `left_turns`, `right_turns` (built field by field). Now included, with a unit test.
- **Actions (supersedes the ⋯ menu):** Rovy-style floating bar at the bottom (`TripActionBar`): orange **Change Vehicle** pill and red round **Delete**, over a progressive blur + fade to the canvas so content scrolls out underneath. **Share** moves to the header's right circle. The page leaves `TRIP_ACTION_BAR_SPACE` at the bottom so the last card scrolls clear.
- **Glass buttons:** every floating control on the page (header back / share, map expand, full-screen close / Events / heatmap, Change Vehicle, Delete) is a `GlassButton` — Liquid Glass on iOS 26 (interactive), blur fallback elsewhere. Coloured actions use tinted glass at 78 % so they read as glass yet keep white text legible. "Drive Analysis" heading reduced to 20 pt.
- **Replay Drive** (moved out of "later"): glass button under the map opens `ReplayModal` — the car (accent disc with a heading arrow) retraces the route while the driven part fills in with speed colours over a faint full route. Top: close · Follow / Overview · Events. Bottom: Speed / Distance / G-Force readouts and a player (play/pause, draggable scrubber, elapsed / total drive time, 1× / 2× / 4×). 1× plays the whole drive in 15–60 s; pauses over 10 min take no replay time. Follow keeps the car centred at street zoom; dragging the map drops back to Overview. Pure helpers `buildReplay` / `replayAt` (interpolated position, speed, distance, G, heading) are unit-tested. Web shows the route without playback.
