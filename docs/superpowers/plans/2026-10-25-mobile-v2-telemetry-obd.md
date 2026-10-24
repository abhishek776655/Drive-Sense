# Telemetry tab (OBD-II) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read live engine data from a BLE ELM327 adapter, show it on a 5th Telemetry tab, and keep a summary and chart series of it with every recorded drive.

**Architecture:** A pure TypeScript OBD core (`src/obd/`: PID table, ELM327 framing, supported-PID tracking, event-driven poll loop, derived values, downsampling) sits behind one BLE file (`bleTransport.ts`, `react-native-ble-plx`). A Zustand store feeds the tab; a recorder mirrors `driveRecorder.ts` by writing 1 Hz rows to a working table and turning them into a summary + series when the drive is saved.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, Zustand, expo-sqlite (`SqlDb`), react-native-svg, react-native-ble-plx 3.5.x, Jest.

Spec: `docs/superpowers/specs/2026-10-25-mobile-v2-telemetry-obd-design.md`

## Global Constraints

- BLE ELM327 adapters only; scan service UUIDs `FFF0`, `FFE0`, `18F0`.
- Poll loop is event-driven (no `setInterval`); each reply triggers the next request.
- Raw samples at 1 Hz only while a drive records; summary + series (≤ 600 points) kept per drive; raw rows deleted.
- **Spec change (found while planning):** a trip's id changes from `local:<startedAt>` to the server id after upload, so OBD data is keyed by the drive's start time in its own table `trip_obd`, not columns on `trip_details`.
- Components read semantic theme tokens only (`useAppTheme()`); units via `useUnits()`.
- No OBD server sync in v1.
- Run `npx tsc --noEmit`, `npx expo lint` and `npx jest` before declaring done.

## File map

| File | Responsibility |
|---|---|
| `src/obd/pids.ts` | PID table + decoders (pure) |
| `src/obd/elm327.ts` | Init commands, request building, reply parsing (pure) |
| `src/obd/supported.ts` | Supported-PID bitmaps, 3-strike drop (pure) |
| `src/obd/derive.ts` | Fuel flow, economy, gear, boost (pure) |
| `src/obd/series.ts` | Summary + downsampled series from 1 Hz rows (pure) |
| `src/obd/pollLoop.ts` | Event-driven scheduler over a `Transport` interface |
| `src/obd/bleTransport.ts` (+ `.web.ts`) | ble-plx scan/connect/notify; the only BLE file |
| `src/stores/obdStore.ts` | Connection state, latest values, 60 s history, pairing |
| `src/obd/useObdLink.ts` | Hook in tabs layout: auto-connect the paired adapter, run the loop |
| `src/sync/obdRecorder.ts` | 1 Hz rows while recording; finalize on save/discard |
| `src/db/schema.ts`, `src/db/repos.ts` | Migration v6 + OBD repos |
| `src/app/(tabs)/telemetry.tsx` | The tab |
| `src/components/telemetry/*` | Dial, tiles, sparkline, pairing sheet, adapter card |
| `src/components/trip/CarSection.tsx` | Trip Detail "Car" section |

---

### Task 1: Pure OBD core

**Files:** Create `src/obd/pids.ts`, `src/obd/elm327.ts`, `src/obd/supported.ts`, `src/obd/derive.ts`; tests in `src/obd/__tests__/`.

**Produces:**
- `type PidKey = 'speed' | 'rpm' | 'throttle' | 'load' | 'coolant' | 'intakeTemp' | 'maf' | 'map' | 'baro' | 'fuelLevel' | 'voltage' | 'ambient' | 'oilTemp' | 'fuelRate' | 'status' | 'runTime' | 'distSinceClear'`
- `PIDS: Record<PidKey, {code: string; bytes: number; tier: 'fast' | 'slow' | 'once'; decode: (b: number[]) => number}>`
- `ELM_INIT: string[]`, `pidRequest(code): string`, `parseReply(raw, code): number[] | null` (handles echo, spaces, `SEARCHING...`, `NO DATA`, multi-frame), `isElmError(raw): boolean`, `decodeStatus(b) → {mil: boolean; codeCount: number}`
- `decodeSupported(base, bytes): string[]`, `class SupportTracker {setSupported(codes); has(code); recordEmpty(code); recordOk(code)}`
- `fuelFlowLph({fuelRate, maf}, fuel: FuelType): number | null`, `economyL100(flowLph, kmh): number | null`, `boostKpa(map, baro): number | null`, `estimateGear(rpm, kmh, ratios: number[]): number | null`

- [ ] Write tests: each PID decodes SAE examples (`41 0C 1A F8` → 1726 rpm; `41 05 7B` → 83 °C; `41 0D 3C` → 60; `41 42 37 0A` → 14.09 V); `parseReply` strips echo/`SEARCHING...`, returns null on `NO DATA`; supported bitmap `BE 1F A8 13` for base `00` contains `01,03,04,05,06,07,0C,0D,0E,0F,10,11,13,15,1C,1F,20`; tracker drops after 3 empties, resets on ok; fuel flow MAF 10 g/s petrol ≈ 3.27 L/h; economy null below 5 km/h; boost null when ≤ 0.
- [ ] Run `npx jest src/obd` → fail. Implement. Run → pass. Commit.

### Task 2: Poll loop

**Files:** Create `src/obd/pollLoop.ts`, test `src/obd/__tests__/pollLoop.test.ts`.

**Consumes:** Task 1. **Produces:**
- `interface Transport {write(text: string): Promise<void>; onData(cb: (chunk: string) => void): () => void}`
- `createPollLoop(transport, {onValue(key: PidKey, value: number, at: number), onStatus(s: {mil: boolean; codeCount: number}), onSupported(keys: PidKey[]), onVin(vin: string), onError(e: Error)}, opts?: {knownSupported?: PidKey[]; now?: () => number}) → {start(): Promise<void>; stop(): void}`
- Behaviour: run `ELM_INIT`, read `0100/0120/0140`, read VIN (`0902`) and status once; then cycle = every supported fast PID + MAF/fuel-rate every 2nd cycle + one slow PID in rotation; status every 240 cycles. Replies end at `>`. 3 unparseable replies in a row → re-init. Engine-off (RPM 0 / no answers for 30 s of cycles) slows to status-only.

- [ ] Tests with a fake transport that answers from a scripted table: init order; unsupported PIDs never requested; slow rotation; 3-strike drop; values delivered with keys; `stop()` halts.
- [ ] Fail → implement → pass → commit.

### Task 3: Storage (migration v6) and series

**Files:** Modify `src/db/schema.ts`, `src/db/repos.ts`; create `src/obd/series.ts`; tests `src/db/__tests__/obdRepos.test.ts`, `src/obd/__tests__/series.test.ts`.

**Produces:**
- Tables: `drive_obd_samples(drive_started_at, ts, json)`, `trip_obd(started_at INTEGER PRIMARY KEY, stats TEXT NOT NULL, series TEXT NOT NULL)`, `obd_adapters(vehicle_id PK, device_id, device_name, vin, supported, last_seen, last_state)`.
- `type ObdRow = Partial<Record<'speed'|'rpm'|'throttle'|'load'|'coolant'|'maf'|'fuelRate'|'fuelLevel'|'voltage'|'intakeTemp'|'map', number>> & {fuelFlow?: number}`
- `type ObdStats = {avgRpm: number|null; maxRpm: number|null; maxCoolantC: number|null; fuelUsedL: number|null; avgL100km: number|null; idleS: number; coverage: number}`
- `type ObdSeries = {t: number[]; rpm: (number|null)[]; speed: …; coolant: …; fuelFlow: …; throttle: …; load: …}`
- `summarize(rows: {ts: number; row: ObdRow}[], driveSeconds: number, distanceM: number): ObdStats`, `downsample(rows, startedAt, max = 600): ObdSeries` (max for rpm/coolant, mean otherwise, null for empty buckets)
- Repos: `appendObdSamples(db, startedAt, rows)`, `obdSamples(db, startedAt)`, `clearObdSamples(db, startedAt)`, `putTripObd(db, startedAt, stats, series)`, `tripObd(db, startedAtMs): {stats, series} | null` (matches ±2 s), `deleteTripObd(db, startedAtMs)`, `getAdapter(db, vehicleId)`, `putAdapter(db, a)`, `deleteAdapter(db, vehicleId)`, `adapterByDevice(db, deviceId)`.

- [ ] Tests: v6 applies on a fresh DB (`node:sqlite` test DB like existing repo tests); round-trip all repos; summarize coverage/idle/fuel; downsample keeps peak and gaps and caps at 600.
- [ ] Fail → implement → pass → commit.

### Task 4: BLE transport, store and auto-connect

**Files:** `npx expo install react-native-ble-plx`; modify `app.json` (plugin `react-native-ble-plx` with `isBackgroundEnabled: true`, `modes: ["central"]`, `bluetoothAlwaysPermission`); create `src/obd/bleTransport.ts`, `src/obd/bleTransport.web.ts`, `src/stores/obdStore.ts`, `src/obd/useObdLink.ts`; modify `src/app/(tabs)/_layout.tsx`; test `src/stores/__tests__/obdStore.test.ts`.

**Produces:**
- `scanAdapters(onFound: (d: {id: string; name: string}) => void): () => void`, `connectAdapter(id): Promise<Transport & {disconnect(): Promise<void>; onDisconnect(cb): () => void}>`, `bleState(): Promise<'on'|'off'|'unauthorized'|'unsupported'>`
- `useObdStore`: `{link: 'none'|'off'|'waiting'|'connecting'|'live'|'engineOff'|'unsupported'|'error'; values: Partial<Record<PidKey, {v: number; at: number}>>; history: {at: number; rpm?: number; speed?: number; fuelFlow?: number}[] (60 s); supported: PidKey[]; mil: {on: boolean; codes: number} | null; vin: string | null; error: string | null; setLink, putValue, setSupported, setStatus, setVin, reset}`
- `useObdLink()`: for the active vehicle's paired adapter, connect when Bluetooth is on, run the poll loop, reconnect on drop with backoff (2, 5, 10, 30 s), update the store and `obd_adapters.last_state`.

- [ ] Store tests: putValue updates values and trims history to 60 s; reset clears.
- [ ] Implement, typecheck, commit.

### Task 5: Recorder

**Files:** Create `src/sync/obdRecorder.ts`; modify `src/app/_layout.tsx` or wherever `startDriveRecorder` is started, `src/stores/finishedDriveStore.ts` (finalize on show/discard), `src/stores/tripDetailStore.ts` (delete trip → `deleteTripObd`); test `src/sync/__tests__/obdRecorder.test.ts`.

**Produces:** `startObdRecorder(): () => void` (once per second while status = recording, writes the latest values seen in that second), `finalizeObd(db, drive: FinishedDrive): ObdStats | null`, `discardObd(db, startedAt)`.

- [ ] Tests: rows written only while recording; finalize writes `trip_obd` and clears samples; no rows → null and nothing written.
- [ ] Fail → implement → pass → commit.

### Task 6: Telemetry tab

**Files:** Create `src/app/(tabs)/telemetry.tsx`, `src/components/telemetry/{RpmDial,ObdTile,Sparkline,PairSheet,AdapterCard}.tsx`; modify `src/app/(tabs)/_layout.tsx`, `src/components/GlassTabBar.tsx` (`ICONS.telemetry = 'gauge'`), `src/components/TabIcons.tsx` (new `gauge` glyph).

- [ ] States: no adapter (explainer + Pair), Bluetooth off/unauthorized, waiting/connecting with last values, unsupported, live (RPM dial with speed + gear, tiles for supported values only, sparklines, MIL banner, recording chip).
- [ ] Tile warnings: coolant amber ≥ 105 °C, red ≥ 115 °C; voltage amber < 12.0 V engine off or < 13.2 V running.
- [ ] Typecheck, lint, commit.

### Task 7: Garage, Settings, Trip Detail

**Files:** Modify `src/app/(tabs)/garage.tsx` (AdapterCard under the hero), `src/stores/preferencesStore.ts` (`obdAutoStart: boolean`, default false), `src/app/settings/index.tsx` (Car adapter switch), `src/app/trip/[id].tsx` (+ `src/components/trip/CarSection.tsx`).

- [ ] Car section: summary tiles (fuel used, avg L/100 km, avg/max RPM, max coolant, idle) and RPM, coolant, fuel flow line charts via `linePath`; coverage note < 90 %.
- [ ] `useObdLink` starts a drive with the default vehicle when `obdAutoStart` is on and the adapter goes live while Ready.
- [ ] Preferences sanitize test for the new key. Typecheck, lint, jest, commit.

### Task 8: Verify

- [ ] `npx tsc --noEmit`, `npx expo lint`, `npx jest` all clean.
- [ ] Build with `npx expo run:ios`; open the Telemetry tab on the simulator; check the no-adapter and Bluetooth states render (the simulator has no Bluetooth, so live data needs the spike on a real phone).
- [ ] Update the spec's storage section for `trip_obd`.
