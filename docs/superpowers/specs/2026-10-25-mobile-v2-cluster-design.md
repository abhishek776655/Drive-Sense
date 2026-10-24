# DriveSense v2: Cluster mode (full-screen landscape digital cluster)

Date: 2026-10-25
App: `drive-sense-v2` (Expo SDK 57)
Builds on: `2026-10-25-mobile-v2-telemetry-obd-design.md`, `2026-10-25-mobile-v2-telemetry-sources-design.md`

## Goal

A button on the Telemetry tab opens a full-screen, landscape digital instrument cluster that shows
the drive's main data on one screen, with the motion and depth of a premium car cluster. Several
layouts will exist and the driver switches between them; this spec builds the framework and the
first layout, inspired by Mercedes-Benz's twin-dial digital cluster.

## Decisions

- **Inspired by, not a copy.** The first layout takes the twin-dial arrangement, glowing arcs,
  restrained typography and fluid motion of Mercedes' cluster. It uses no Mercedes logos, marks,
  typefaces or artwork, and is named "Twin" in the app.
- **Layouts are switchable.** One cluster screen, any number of layouts behind one interface;
  later layouts (centre-map style, sport style) are separate specs.
- **Centre panel: swipeable pages** — Trip, Engine (animated engine load), Car, Map.
- **Works without an adapter** ("phone-only"): GPS speed, and a G-force dial instead of RPM.
- **Always dark**, with an accent the driver picks (orange, blue, teal, red, purple); default is
  the Drive tab's speedometer accent.
- **Rendering: Skia + Reanimated.** `@shopify/react-native-skia` for GPU drawing (real glow, blur,
  gradients, shadows); `react-native-reanimated` for motion on the UI thread, so it stays smooth
  while JS is busy with the adapter; `react-native-gesture-handler` for the page swipe. Reanimated
  and Gesture Handler are already in `node_modules` (pulled in by other packages) and become direct
  dependencies. All three need a development build.
- **Landscape by screen, not app-wide.** A root-stack route with native-stack
  `orientation: 'landscape'`; every other route stays portrait. `app.json` allows landscape so iOS
  can rotate (regenerated iOS project). Fallback if per-screen orientation misbehaves on iOS 27:
  `expo-screen-orientation` lock on open and unlock on close.

## 1. Entry and chrome

- **Open:** a "Cluster" button (speedometer icon) at the top of the Telemetry tab's live view, and
  on the no-adapter state too (phone-only). Route `src/app/cluster.tsx`, presented full-screen
  with a cross-fade.
- **Full screen:** status bar hidden, home indicator auto-hidden, keep-awake on while open
  (`expo-keep-awake`).
- **Controls:** hidden by default. A tap anywhere shows a thin top row for 3 s — close (✕), layout
  name with a switcher, accent dots — fading in over 200 ms and out over 400 ms.
- **Close:** ✕, or the back gesture on Android; returns to portrait Telemetry.
- **Remembered:** layout and accent in preferences (`clusterLayout`, `clusterAccent`).

## 2. Data

One hook, `useClusterData()`, gives every layout the same plain object, refreshed from the stores:

| Field | Source |
|---|---|
| `speedKmh` | adapter speed when fresh, else GPS (step 1 rules) |
| `rpm`, `gear`, `redline` | adapter; redline 6,000 (petrol) / 4,500 (diesel) |
| `g` (`{lon, lat}`) | worked out from speed and heading, so it doesn't depend on how the phone is mounted: longitudinal = change in speed ÷ time, lateral = speed × rate of heading change (both ÷ 9.81, smoothed) |
| `coolantC`, `fuelPct`, `rangeKm`, `voltage`, `boostKpa`, `intakeC`, `oilC` | adapter + range hook |
| `driveS`, `distanceM`, `driveL100km`, `fuelUsedL`, `cost` | recording store, drive mileage hook, fuel price |
| `route` | the recording drive's route (map page) |
| `loadPct`, `throttlePct`, `coasting` | adapter (PIDs 04, 11); coasting = moving with the throttle closed (eco rule from telemetry sources step 4) |
| `carState` | running / engineOff / parked (telemetry sources) |
| `alerts` | check-engine, low battery, coolant hot, low fuel |
| `mode` | `adapter` or `phoneOnly` |

Values that are null hide their element; a page with nothing to show is left out of the pager.

## 3. "Twin" layout

Landscape canvas, safe areas respected, everything scaled from screen height.

- **Left dial — speed:** 270° sweep. Major ticks every 20 km/h (mph in imperial), minor every
  10; scale end from the Drive tab's speed scale. Large tabular number in the centre with the unit
  under it.
- **Right dial — RPM:** same construction, 0–8,000 (or a round step above the highest seen).
  A red band from the redline to the end. Gear in a small rounded box under the number ("N" at a
  standstill, hidden until known). Phone-only: becomes a **G dial** — a dot inside rings at
  0.25/0.5/0.75 g, with the peak as a fading ghost dot.
- **Centre panel:** a rounded glass panel between the dials holding the pager (section 5) and
  page dots below it.
- **Bottom strip:** two short bar gauges (coolant left, fuel right, with range); warning icons
  centre (check-engine amber, battery amber, engine off / parked state); clock time.

## 4. Motion and depth

All motion runs on the UI thread (Reanimated shared values feeding Skia).

- **Value smoothing:** speed and RPM follow their readings through a critically damped spring
  (about 180 ms to settle for RPM, 300 ms for speed), so the arc sweeps and settles like a needle
  instead of jumping between 4 Hz readings.
- **Arc glow:** the lit arc is drawn three times — a sharp core, a 6 px blurred glow, and a
  20 px wide, low-opacity bloom — in the accent colour, with a gradient that brightens toward the
  leading edge.
- **Glow trail:** when the value drops, the lit arc above it fades out over 300 ms instead of
  vanishing (the "afterglow" when coming off the throttle).
- **Redline:** the red band brightens as RPM comes within 1,000 of it; at the redline the dial's
  ambient light turns red and pulses at 2 Hz.
- **Ticks:** each tick lights up (accent, then fades back to grey over 600 ms) as the arc passes it.
- **Ambient light:** a large soft radial glow behind each dial in the accent colour, its strength
  following load (RPM share) or speed, easing over 500 ms.
- **Depth:** dials have a faint radial vignette, a thin bevelled rim (light top edge, dark bottom),
  and a soft drop shadow onto the background; the centre panel is frosted glass (blurred backdrop,
  1 px light border, inner shadow).
- **Numbers:** tabular figures; changing digits roll vertically by a few pixels with a fade so
  they never flicker.
- **Start-up sweep:** on opening, both dials sweep to full and back over 1.2 s (ease in-out), then
  the live values fade in over 300 ms.
- **Reduce Motion:** smoothing stays (it is information), sweeps, trails, pulses and rolling digits
  are dropped.

## 5. Centre pager

- **Pages:** Trip (drive time, distance, mileage this drive, fuel used, cost; "Not recording"
  with mileage now when no drive is on), Engine (below), Car (coolant, battery, boost, intake, oil, fuel and range,
  as a two-column list), Map (dark map following the car, route in the accent colour; native maps
  in a clipped rounded view).
- **Engine page (animated engine load):**
  - A wide **power meter**: a 180° arc showing engine load 0–100 % with the same core, glow and
    bloom as the dials; a thin inner arc shows throttle position, so the gap between "asked for"
    and "delivered" is visible as you press the pedal.
  - **Energy flow:** a stream of small light particles runs along the arc from its base toward the
    lit end; their speed and density follow load (a trickle at cruise, a rush under hard
    acceleration). Load above 80 % warms the stream from the accent toward amber.
  - **Coasting:** with the throttle closed while moving, the arc drains to zero, the particles
    reverse and slow, and the arc turns green with "Coasting · fuel cut" — engine braking made
    visible.
  - **Load trace:** under the meter, the last 30 s of load as a scrolling filled line, newest on the
    right, fading toward the left.
  - The large number in the middle is load %, with throttle % and boost (turbo cars) beneath.
  - Hidden in phone-only mode (load needs the adapter).
- **Swipe:** the page follows the finger 1:1; on release it springs to the nearest page
  (velocity-aware). Pages away from centre scale to 94 %, fade to 40 % and blur up to 8 px with
  distance, so the current page sits forward. The active dot stretches into a pill while moving.
- **Haptic:** a light selection tick when a page settles.

## 6. Architecture

| Unit | Job |
|---|---|
| `src/app/cluster.tsx` | The route: orientation, full screen, keep-awake, chrome, layout switch. |
| `src/cluster/useClusterData.ts` | The data object (section 2), from existing stores and hooks. |
| `src/cluster/layouts.ts` | Layout registry: id, name, component. |
| `src/cluster/twin/TwinLayout.tsx` | The first layout (section 3). |
| `src/cluster/parts/ArcDial.tsx` | Skia dial: ticks, arc, glow, trail, redline, number. Reused by later layouts. |
| `src/cluster/parts/GDial.tsx` | Skia G-force dial. |
| `src/cluster/parts/CentrePager.tsx` | Gesture pager with depth effects (section 5). |
| `src/cluster/parts/LoadMeter.tsx` | Skia engine-load page: power arc, throttle arc, particle flow, coasting state, load trace. |
| `src/cluster/parts/BarGauge.tsx`, `RollingNumber` | Small gauges and digits. |
| `src/cluster/motion.ts` | Pure maths: value→angle, tick lit state, trail decay, redline intensity, spring settings. |

Dials take smoothed shared values, not React state, so a reading never re-renders the tree.

## 7. Errors and edge cases

| Case | Behaviour |
|---|---|
| Adapter drops mid-view | Switches to phone-only within one reading; the RPM dial cross-fades to the G dial. |
| No GPS fix yet | Speed shows "—"; map page shows "Waiting for location". |
| Not recording | Trip page shows "Not recording" with live mileage now; map follows position without a route. |
| Phone locked or app backgrounded | Nothing to draw; values resume (no start-up sweep) on return. |
| Small phones | Everything scales from height; centre panel narrows first, dials keep their size. |

## 8. Testing

- **Unit (Jest):** `motion.ts` (angles, tick lighting, trail decay, redline intensity, particle speed from load, coasting state), the data
  hook's mapping (adapter vs phone-only, hidden fields), layout registry.
- **Manual:** simulator with the simulated adapter: start-up sweep, revving with the glow trail,
  redline pulse, page swipe, phone-only switch on adapter dropout, rotation back to portrait on
  close. Frame rate checked with the performance monitor (target 60 fps on the iPhone 17 simulator).

## 9. Out of scope

Other layouts (their own specs), navigation directions, media, voice, Android Auto/CarPlay output,
user-editable cluster content.
