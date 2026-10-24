# DriveSense v2: Telemetry tab (OBD-II)

Date: 2026-10-25
App: `drive-sense-v2` (Expo SDK 57)

## Goal

Read live engine data from the car through a Bluetooth Low Energy (BLE) ELM327 OBD-II adapter, show
it on a new Telemetry tab, and keep a summary and chart series of it with every recorded trip.

## Decisions

- **Hardware:** BLE ELM327 adapters only (Vgate iCar Pro BLE, OBDLink CX, Veepeak BLE and clones).
  Classic Bluetooth adapters are out (iOS cannot use them without Apple MFi). Wi-Fi adapters are out.
- **Scope:** live dashboard plus per-trip OBD data. Reading trouble codes (DTCs), readiness
  monitors and clearing codes are a later "car health" spec. Only the check-engine light state and
  code count are read here.
- **Placement:** a 5th tab, **Telemetry**: Home · Logbook · Drive · Garage · Telemetry. (This takes
  the slot the redesign kept for Leaderboard; Leaderboard's placement is decided in its own spec.)
- **Connection:** automatic. A paired adapter connects by itself whenever it is powered (car on),
  in the foreground and in the background, including with the app closed on iOS (state restoration).
- **Auto-start:** an adapter connecting can start a drive. Off by default, toggled in Settings.
- **Library:** `react-native-ble-plx` for scan/connect/notify; the ELM327 protocol, PID decoding and
  polling are our own TypeScript. Needs a development build; does not run in Expo Go.
- **Storage:** raw 1 Hz samples only while a drive records (a working table, like `drive_points`);
  when the drive ends they become a summary and downsampled chart series on `trip_details`, and the
  raw rows are deleted.
- **No server sync in v1.** OBD data stays on the phone. The summary and series are small JSON so
  they can ride along with a trip upload later without changing format.
- **Not for EVs / most hybrids:** they do not answer standard Mode 01 PIDs; the tab says so.

## 0. Spike first

Before Task 1 of the plan, a throwaway build on the user's iPhone and an Android phone, with a real
adapter, answers:

1. Does the event-driven poll loop (section 3) keep delivering samples with the phone locked during
   a drive (iOS: `bluetooth-central` + `location` background modes)?
2. Does iOS state restoration relaunch the app and reconnect when the car turns on with the app
   closed?
3. Real sample rate per adapter (target: fast PIDs at ≥ 4 Hz).

If (1) fails, only the poll loop moves into a small native Expo module (Swift/Kotlin) that writes
samples to the working table; everything above it stays. Results are written into this spec under
"Spike results" before implementation starts.

## 1. Data points

On connect the app reads the car's supported-PID bitmaps (Mode 01 PIDs `00`, `20`, `40`, `60`) and
polls only what the car supports. Formulas are the SAE J1979 ones.

| Group | Value | PID | Unit | Poll |
|---|---|---|---|---|
| Fast | Vehicle speed | `0D` | km/h | every cycle |
| | Engine RPM | `0C` | rpm | every cycle |
| | Throttle position | `11` | % | every cycle |
| | Calculated engine load | `04` | % | every cycle |
| Slow | Coolant temperature | `05` | °C | every 20th cycle (~5 s) |
| | Intake air temperature | `0F` | °C | slow |
| | Mass air flow (MAF) | `10` | g/s | every 2nd cycle (fuel needs it) |
| | Intake manifold pressure (MAP) | `0B` | kPa | slow |
| | Barometric pressure | `33` | kPa | once per connect |
| | Fuel tank level | `2F` | % | slow |
| | Control module voltage | `42` | V | slow (fallback: adapter `ATRV`) |
| | Ambient air temperature | `46` | °C | slow |
| | Engine oil temperature | `5C` | °C | slow |
| | Engine fuel rate | `5E` | L/h | every 2nd cycle, replaces MAF when present |
| Once | Check-engine light + code count | `01` | — | on connect, then every 60 s |
| | Run time since engine start | `1F` | s | on connect |
| | Distance since codes cleared | `31` | km | on connect |
| | VIN | Mode 09 `02` | — | on connect |

**Derived on the phone:**
- Fuel flow (L/h): `5E` if supported, else `MAF / 14.7 / 745 × 3600` (petrol; diesel uses 14.5 and
  832 g/L, picked from the vehicle's fuel type).
- Instant economy (L/100 km): `fuel flow / speed × 100`, shown only above 5 km/h.
- Fuel used per trip: fuel flow integrated over time.
- Engine-on idle time: RPM > 0 and speed = 0.
- Estimated gear: RPM ÷ speed ratio, clustered into gears learned per vehicle; shown only when
  stable. "N" when speed is 0.
- Boost: `MAP − barometric`, shown only when it goes above 0 (turbo cars).

Display units follow the user's unit system (`useUnits`): km/h↔mph, °C↔°F, L/100 km↔mpg.

## 2. Telemetry tab

Route `src/app/(tabs)/telemetry.tsx`, tab icon added to `TabIcons.tsx`. Same Rovy look as the other
tabs (gear button top-right opens Settings).

**States:**

1. **No adapter paired:** short explainer ("Plug a Bluetooth OBD-II adapter into the port under the
   dashboard"), illustration, **Pair adapter** button.
2. **Pairing:** a sheet that scans for BLE devices advertising ELM327 service UUIDs (`FFF0`, `FFE0`,
   `18F0`) or a known name. Tap one → connect → init → read VIN → "Paired to <vehicle>". The pairing
   is saved for the active vehicle.
3. **Waiting:** adapter card with status ("Waiting for car", "Connecting…") and the last values seen
   with how long ago.
4. **Not supported:** car answered no Mode 01 PIDs (EV, some hybrids) → message, unpair option.
5. **Live:**
   - **Hero dial** (reuses `GaugeDial` styling): RPM with a redline band; speed in the centre;
     estimated gear under it.
   - **Tiles** (2-column grid, `BentoTile`/`HalfTile`): coolant, engine load, throttle, fuel flow
     (L/h + L/100 km), battery voltage, intake temperature, fuel level, boost, oil temperature,
     ambient temperature. A tile the car does not support is hidden, never shown as "—".
   - **Sparklines** on RPM, speed and fuel flow: the last 60 s from an in-memory ring buffer.
   - **Check-engine banner** when the light is on: "Check engine light on · 2 codes". Tapping it
     says code details come in a later update.
   - **Recording chip** when a drive is recording ("Saving to this drive").
   - Values tween (`RollingNumber`); coolant tile turns amber ≥ 105 °C and red ≥ 115 °C; voltage
     tile turns amber < 12.0 V with the engine off or < 13.2 V with it running.

**Garage:** the vehicle card shows the paired adapter with status, plus Unpair. Pairing can also
start from there.

**Settings:** a "Car adapter" row: auto-start drives when the adapter connects (off by default).

## 3. Architecture

New folder `src/obd/`, every file one job:

| File | Job |
|---|---|
| `elm327.ts` | AT command init (`ATZ`, `ATE0`, `ATL0`, `ATS0`, `ATH0`, `ATSP0`), request/response framing (wait for `>` prompt), reply cleanup (`SEARCHING...`, `NO DATA`, `STOPPED`, `?`). Transport-agnostic: takes `write(text)` and an `onData` stream. |
| `pids.ts` | PID table: code, bytes, decode formula, unit, fast/slow tier. Pure functions. |
| `supported.ts` | Decode the supported-PID bitmaps; drop a PID after 3 empty replies in a row (clones claim PIDs they don't answer). |
| `pollLoop.ts` | The scheduler. **Event-driven, no timers:** each reply triggers the next request. Cycle = all fast PIDs + one slow PID in rotation. Works in the background on iOS because BLE notify callbacks keep firing when JS timers pause. |
| `derive.ts` | Fuel flow, economy, idle, gear, boost. Pure. |
| `bleTransport.ts` | `react-native-ble-plx`: scan, connect, find the write/notify characteristics, pending reconnect, state restoration id. The only file that touches BLE. |
| `obdStore.ts` (`src/stores/`) | Zustand: connection state, latest values, 60 s ring buffer, supported set, pairing. The tab only reads this. |
| `obdRecorder.ts` | While a drive records: writes one 1 Hz row (latest value of each PID within that second) to `drive_obd_samples`. At drive end: builds summary + series, saves, deletes rows. |
| `series.ts` | Downsampling to ≤ 600 buckets; RPM and coolant keep the bucket max, others the mean. Pure. |

**Data flow:** adapter → `bleTransport` → `elm327` → `pollLoop` → decoded value → `obdStore`
(live) and `obdRecorder` (when recording) → `trip_details` at drive end → Trip Detail.

**Background:**
- iOS: add `bluetooth-central` to `UIBackgroundModes` (now `location`, `bluetooth-central`), plus
  `NSBluetoothAlwaysUsageDescription`, via `app.json` / the ble-plx config plugin. ble-plx
  `restoreStateIdentifier` set; paired adapter kept on a pending connect so iOS reconnects when it
  powers up.
- Android: `BLUETOOTH_SCAN` (`neverForLocation`) and `BLUETOOTH_CONNECT` permissions; polling runs
  inside the existing drive foreground service. Outside a drive the app connects when it is opened
  or when the auto-start setting is on (then a foreground service notification "Waiting for your
  car" is shown).

**Speed source:** while OBD is connected, OBD speed (`0D`) is stored next to GPS speed; the
recording's speed and distance stay GPS-based in v1 (no change to scoring). OBD speed is used only
for the Telemetry display and the OBD series.

## 4. Storage

Migration **v6** in `src/db/schema.ts`:

```sql
CREATE TABLE drive_obd_samples (
  drive_started_at INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  json TEXT NOT NULL,
  PRIMARY KEY (drive_started_at, ts)
);
ALTER TABLE trip_details ADD COLUMN obd_stats TEXT;
ALTER TABLE trip_details ADD COLUMN obd_series TEXT;
CREATE TABLE obd_adapters (
  vehicle_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  vin TEXT,
  supported TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  last_state TEXT
);
```

`TABLES` gains `drive_obd_samples` and `obd_adapters`.

- **`drive_obd_samples.json`:** one second: `{speed, rpm, throttle, load, coolant, maf, fuelRate,
  fuelLevel, voltage, intakeTemp, map}`; unsupported or missing → absent. Deleted when the drive
  is saved or discarded. A crash mid-drive leaves the rows for the recovered drive, like
  `drive_points`.
- **`trip_details.obd_stats`:** `{avgRpm, maxRpm, maxCoolantC, fuelUsedL, avgL100km, idleS,
  coverage}`. `coverage` = seconds with OBD data ÷ drive seconds (0–1). NULL when the drive had no
  OBD data.
- **`trip_details.obd_series`:** column-wise, `{t: number[], rpm: number[], speed: number[],
  coolant: number[], fuelFlow: number[], throttle: number[], load: number[]}`, ≤ 600 entries each;
  `t` is seconds from drive start; missing seconds → `null` so charts show gaps. About 20–30 KB.
- **`obd_adapters`:** per vehicle on this phone (pairing is device-local, so it is not in the
  synced `vehicles.json`). `supported` is the PID list from the last connect; `last_state` is JSON
  `{mil, codeCount, fuelLevel, voltage, readAt}`.
- **Not stored:** the 4–5 Hz stream (memory only); DTC details (later spec).

Deleting a trip deletes its `trip_details` row as today, which removes its OBD data.

## 5. Trip Detail

A **Car** section, shown only when `obd_stats` is not NULL:
- Summary tiles: fuel used, average L/100 km, average/max RPM, max coolant, idle time.
- Charts (reuse `TrendChart` styling) from `obd_series`: RPM, coolant, fuel flow; gaps drawn as
  breaks.
- When `coverage < 0.9`: a note "Car data for 72% of this drive".

## 6. Errors and edge cases

| Case | Behaviour |
|---|---|
| Bluetooth off / permission denied | Tab shows the reason and a button to Settings. |
| Adapter drops mid-drive | Recording continues on GPS; samples stop; pending reconnect resumes them; gap shows in charts and coverage. |
| Car off, adapter still powered (some cars) | RPM 0 and no answers for 30 s → "Engine off"; poll slows to one `01` request every 10 s to save the car battery. |
| Garbage / partial reply | Framing waits for `>`; unparseable reply dropped; 3 in a row → re-run init. |
| `NO DATA` for a PID | Counted; dropped after 3 in a row (section 3, `supported.ts`). |
| VIN differs from the paired vehicle | Banner "This adapter is in a different car" with Switch vehicle / Ignore. |
| Car answers no Mode 01 PIDs | "Not supported" state. |
| Drive paused | Live values keep showing; no samples written. |
| Two adapters nearby | Only the paired `device_id` is connected; scanning only happens in the pairing sheet. |

## 7. Testing

- **Unit (Jest, pure):** `pids.ts` decode for every PID against SAE examples; `supported.ts`
  bitmaps and the 3-strike drop; `elm327.ts` with recorded reply transcripts from a real Vgate and a
  clone (including `SEARCHING...`, echo on, split notifies); `pollLoop.ts` cycle order and slow
  rotation with a fake transport; `derive.ts` fuel and gear maths; `series.ts` downsampling keeps
  peaks and gaps.
- **Store:** `obdStore` state transitions with a fake transport.
- **DB:** migration v6 applies on a v5 database; recorder writes, summarises and deletes.
- **Manual on device:** pairing, live tab, locked-phone drive, app-closed reconnect (iOS),
  Android foreground service, auto-start setting.

## 8. Out of scope

- Reading/clearing trouble codes, readiness monitors, freeze frame (car-health spec).
- Server sync of OBD data.
- Using OBD speed for distance or driving score.
- Classic Bluetooth and Wi-Fi adapters; manufacturer-specific PIDs (Mode 22).
- Android Auto / Live Activity showing OBD values.

## Spike results

_Filled in after section 0 runs._
