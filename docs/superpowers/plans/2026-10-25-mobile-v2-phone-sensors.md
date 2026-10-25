# Phone Sensors (Telemetry Sources Step 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the four phone-sensor features of the telemetry sources spec (section 3): barometer elevation, cornering force, road roughness and phone use while driving.

**Architecture:** Each feature is a pure, unit-tested module under `src/tracking/sensors/` plus a thin native feed hook. Barometer altitude is fused into the recording store, so live elevation, the cluster's Climb dial and every saved route point use it, and Trip Detail's existing elevation charts improve with no extra work. Cornering, roughness and phone use build up a per-drive summary in a small Zustand store (`sensorDriveStore`). The summary is snapshotted to a new local table `trip_sensors` while driving and saved at the drive's end, keyed by start time like `trip_obd`. Trip Detail reads it to show the hardest corner (in the G-Force card), rough spots on the route map, and a road and phone-use section.

**Tech Stack:** Expo SDK 57, `expo-sensors` (Barometer, DeviceMotion), React Native `AppState`, Expo Router `usePathname`, Zustand, expo-sqlite via `SqlDb`, Jest with `memoryDb`.

## Global Constraints

- From the spec: "Barometer elevation: `expo-sensors` Barometer relative altitude, sampled with each GPS fix; replaces GPS altitude for climb/descent when present."
- From the spec: "Cornering force: gyroscope yaw rate × speed → lateral G; peak per turn; Trip Detail shows the hardest corner and joins the G-Force card."
- From the spec: "Road roughness: vertical accelerometer variance per 100 m, bucketed smooth / fair / rough; rough spots shown on the route map."
- From the spec: "Phone use while driving: time the app is in the foreground and the screen unlocked while moving above 10 km/h, excluding the Drive and Telemetry tabs (navigation use). Shown on Trip Detail; not part of the score in v1." The cluster also counts as navigation use.
- Sensor data stays on the phone, like OBD data. Nothing new is uploaded.
- Sensors run only while needed: barometer and motion while recording, or while the cluster is open (barometer only). Phone use counts only while recording.
- The Simulator has no barometer, gyroscope or real motion. Logic is verified with unit tests; the native feeds must fail quietly when a sensor is unavailable.
- Project rules: no raw colour literals in `src/app/` files (token contract test); React Compiler lint (no synchronous setState in effects, no ref reads during render); use `.set()` on shared values.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/tracking/sensors/barometer.ts` | Pressure → altitude; fusing barometer change onto a GPS base; elevation gain with 1 m hysteresis |
| `src/tracking/sensors/cornering.ts` | Yaw rate about gravity from DeviceMotion; lateral G; corner tracker (peak per turn, hardest corner) |
| `src/tracking/sensors/roughness.ts` | Vertical acceleration; per-100 m RMS segments; smooth / fair / rough buckets; road summary |
| `src/tracking/sensors/phoneUse.ts` | Whether the app in its current state counts as phone use; a seconds accumulator |
| `src/tracking/sensors/types.ts` | `TripSensors` (the saved per-drive summary) and its parts |
| `src/tracking/useBarometerFeed.native.ts` / `.ts` | Barometer → `recordingStore.ingestPressure` (web/default: no-op) |
| `src/tracking/useDeviceMotionFeed.native.ts` / `.ts` | DeviceMotion → `sensorDriveStore` (corners, roughness) (web: no-op) |
| `src/tracking/usePhoneUseFeed.ts` | AppState + route + speed → `sensorDriveStore.addPhoneUse` |
| `src/stores/sensorDriveStore.ts` | The drive in progress: corner tracker, roughness segmenter, phone use; `summary()`; `reset()` |
| `src/db/sensorRepos.ts` | `putTripSensors`, `tripSensors`, `deleteTripSensors` |
| `src/db/schema.ts` | Migration v7: `trip_sensors` table |
| `src/stores/recordingStore.ts` | `ingestPressure`; barometer-fused altitude and elevation gain |
| `src/sync/sensorRecorder.ts` | Snapshots the summary to the database every 30 s while recording |
| `src/components/trip/RoadSection.tsx` | Trip Detail: road quality bar and phone-use time |
| `src/components/trip/GForceSummaryCard.tsx` | Gains a "Hardest corner" row |
| `src/components/trip/TripRouteMap.types.ts` / `.native.tsx` | Optional `roughSpots` drawn as small circles |

---

### Task 1: Barometer maths

**Files:**
- Create: `src/tracking/sensors/barometer.ts`
- Test: `src/tracking/sensors/__tests__/barometer.test.ts`

**Interfaces:**
- Produces: `pressureToAltitudeM(hPa: number): number`; `fuseAltitude(base: {baroM: number; gpsM: number}, baroM: number): number`; `type ElevationState = {refM: number | null; gainM: number; lossM: number}`; `stepElevation(s: ElevationState, altM: number, hysteresisM?: number): ElevationState`; `BARO_HYSTERESIS_M = 1`.

- [ ] **Step 1: Write the failing test**

```ts
import {BARO_HYSTERESIS_M, fuseAltitude, pressureToAltitudeM, stepElevation} from '../barometer';

describe('barometer', () => {
  it('turns pressure into altitude (sea level at 1013.25 hPa, about 8.3 m per hPa near the ground)', () => {
    expect(pressureToAltitudeM(1013.25)).toBeCloseTo(0, 1);
    expect(pressureToAltitudeM(1012.25) - pressureToAltitudeM(1013.25)).toBeCloseTo(8.3, 0);
    expect(pressureToAltitudeM(900)).toBeCloseTo(988, -1);
  });

  it('lays the barometer change onto the GPS altitude it started from', () => {
    expect(fuseAltitude({baroM: 120, gpsM: 35}, 126.5)).toBeCloseTo(41.5, 5);
  });

  it('counts climb and descent past the hysteresis only', () => {
    let s = {refM: null as number | null, gainM: 0, lossM: 0};
    for (const alt of [100, 100.4, 100.8, 101.2, 103, 102.6, 101.5, 105]) {
      s = stepElevation(s, alt);
    }
    // 100 → 101.2 (+1.2) → 103 (+1.8) → 101.5 (−1.5) → 105 (+3.5); 102.6 is inside the band.
    expect(s.gainM).toBeCloseTo(6.5, 5);
    expect(s.lossM).toBeCloseTo(1.5, 5);
    expect(BARO_HYSTERESIS_M).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/tracking/sensors/__tests__/barometer.test.ts`
Expected: FAIL, cannot find module `../barometer`.

- [ ] **Step 3: Implement**

```ts
/**
 * Barometer elevation (spec 2026-10-25, telemetry sources, section 3): the phone's air pressure gives
 * altitude changes to about a metre, where GPS altitude wanders by tens of metres. Absolute height
 * still comes from GPS; the barometer supplies how it changes.
 */

/** Standard atmosphere: the international barometric formula. */
const SEA_LEVEL_HPA = 1013.25;

/** Altitude (m) for a pressure (hPa) in the standard atmosphere. Only differences matter here. */
export const pressureToAltitudeM = (hPa: number): number => 44330 * (1 - (hPa / SEA_LEVEL_HPA) ** (1 / 5.255));

/** The barometer's change since `base` laid onto the GPS altitude taken at the same moment. */
export const fuseAltitude = (base: {baroM: number; gpsM: number}, baroM: number): number => base.gpsM + (baroM - base.baroM);

/** Climb and descent smaller than this are pressure noise or the car's ventilation. */
export const BARO_HYSTERESIS_M = 1;

export type ElevationState = {refM: number | null; gainM: number; lossM: number};

/** One altitude reading into the running climb and descent, moving the reference only past the band. */
export const stepElevation = (s: ElevationState, altM: number, hysteresisM = BARO_HYSTERESIS_M): ElevationState => {
  if (s.refM == null) {
    return {...s, refM: altM};
  }
  const delta = altM - s.refM;
  if (Math.abs(delta) < hysteresisM) {
    return s;
  }
  return {refM: altM, gainM: s.gainM + Math.max(0, delta), lossM: s.lossM + Math.max(0, -delta)};
};
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx jest src/tracking/sensors/__tests__/barometer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tracking/sensors/barometer.ts src/tracking/sensors/__tests__/barometer.test.ts
git commit -m "feat(v2): barometer altitude and elevation maths"
```

### Task 2: Barometer into recording, feed, cluster

**Files:**
- Modify: `src/stores/recordingStore.ts` (state, `ingestPressure`, altitude block in `ingest`, session reset)
- Create: `src/tracking/useBarometerFeed.native.ts`, `src/tracking/useBarometerFeed.ts`
- Modify: `src/app/(tabs)/_layout.tsx`, `src/app/cluster.tsx`, `src/cluster/usePhoneTrace.ts`
- Test: `src/stores/__tests__/recordingStore.test.ts` (add cases)

**Interfaces:**
- Consumes: Task 1 functions.
- Produces: `RecordingState.ingestPressure(hPa: number, at: number): void`; `LiveStats.altitudeSource: 'gps' | 'baro'`; recorded `Sample.altitudeM` is barometer-fused while the barometer is live.

Behaviour:
- State gains `baro: {base: {baroM: number; gpsM: number} | null; lastAt: number | null; elevation: ElevationState}`, reset with the session (`start`/`end` use `SESSION_RESET`). The `base` survives across `ready` so the cluster's Climb dial works before a drive.
- `ingestPressure(hPa, at)`: `baroM = pressureToAltitudeM(hPa)`. Without a base, it takes one only once a GPS altitude is known (`stats.altitudeM != null`), with `{baroM, gpsM: stats.altitudeM}`. It sets `stats.altitudeM = fuseAltitude(base, baroM)` and `stats.altitudeSource = 'baro'`, and records `lastAt = at`. While `status === 'recording'` it runs `stepElevation` and sets `stats.elevationGainM = elevation.gainM`.
- `ingest()`: the barometer is live when `lastAt != null && sample.timestamp - lastAt <= 5000`. Then the GPS altitude block does not touch `elevationGainM` or `stats.altitudeM`, and the recorded sample's `altitudeM` is replaced with `stats.altitudeM`, so stored routes carry the fused altitude. When it is not live, today's GPS behaviour is unchanged and `altitudeSource = 'gps'`.

- [ ] **Step 1: Write the failing tests** (add to the existing recording store test file, in its style, using its helpers to start a drive and feed fixes)

```ts
it('uses the barometer for altitude and climb once it has a GPS base', () => {
  const s = useRecordingStore.getState();
  s.ingest(fix({altitudeM: 50, timestamp: T0}));
  s.start(VEHICLE, T0);
  s.ingestPressure(1013.25, T0 + 100); // base: baro 0 m ↔ GPS 50 m
  s.ingestPressure(1012.25, T0 + 1100); // ≈ +8.3 m
  expect(useRecordingStore.getState().stats.altitudeM).toBeCloseTo(58.3, 0);
  expect(useRecordingStore.getState().stats.elevationGainM).toBeCloseTo(8.3, 0);
  expect(useRecordingStore.getState().stats.altitudeSource).toBe('baro');
  // A GPS fix while the barometer is live neither moves altitude nor adds climb…
  s.ingest(fix({altitudeM: 90, timestamp: T0 + 2000, latitude: LAT + 0.0002}));
  expect(useRecordingStore.getState().stats.altitudeM).toBeCloseTo(58.3, 0);
  expect(useRecordingStore.getState().stats.elevationGainM).toBeCloseTo(8.3, 0);
  // …and the recorded point carries the fused altitude.
  expect(useRecordingStore.getState().pending.at(-1)?.altitudeM).toBeCloseTo(58.3, 0);
});

it('falls back to GPS altitude when the barometer goes quiet', () => {
  const s = useRecordingStore.getState();
  s.ingest(fix({altitudeM: 50, timestamp: T0}));
  s.start(VEHICLE, T0);
  s.ingestPressure(1013.25, T0);
  s.ingest(fix({altitudeM: 60, timestamp: T0 + 10_000, latitude: LAT + 0.0003}));
  expect(useRecordingStore.getState().stats.altitudeSource).toBe('gps');
  expect(useRecordingStore.getState().stats.altitudeM).toBe(60);
});
```

(`fix`, `T0`, `LAT`, `VEHICLE` are the helpers or constants the test file already uses; reuse whatever it names them.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest src/stores/__tests__/recordingStore.test.ts`
Expected: FAIL, `ingestPressure is not a function`.

- [ ] **Step 3: Implement the store changes** as described in Behaviour above: add `altitudeSource: 'gps'` to `EMPTY_STATS`, and keep `baro.base` across `start` and `end` but reset `baro.elevation`.

- [ ] **Step 4: Native feed**

`src/tracking/useBarometerFeed.ts` (web and default):
```ts
/** No barometer off device: nothing to feed. */
export function useBarometerFeed(_active: boolean): void {}
```

`src/tracking/useBarometerFeed.native.ts`:
```ts
import {Barometer} from 'expo-sensors';
import {useEffect} from 'react';
import {useRecordingStore} from '../stores/recordingStore';

/** One pressure reading a second is plenty: GPS fixes come about as often. */
const SAMPLE_MS = 1000;

/**
 * Air pressure into the recording store while `active` (spec 2026-10-25, telemetry sources,
 * section 3). Phones without a barometer (and the Simulator) simply never report.
 */
export function useBarometerFeed(active: boolean): void {
  const ingestPressure = useRecordingStore((s) => s.ingestPressure);
  useEffect(() => {
    if (!active) {
      return;
    }
    let sub: {remove: () => void} | null = null;
    let cancelled = false;
    Barometer.isAvailableAsync()
      .then((ok) => {
        if (!ok || cancelled) {
          return;
        }
        Barometer.setUpdateInterval(SAMPLE_MS);
        sub = Barometer.addListener(({pressure}) => ingestPressure(pressure, Date.now()));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [active, ingestPressure]);
}
```

- [ ] **Step 5: Mount it.** In `src/app/(tabs)/_layout.tsx`, add `useBarometerFeed(pathname === '/drive' || live);` beside `useLocationFeed`. In `src/app/cluster.tsx`, add `useBarometerFeed(!live);` beside its `useLocationFeed(!live)`.

- [ ] **Step 6: Cluster Climb dial uses the fused altitude.** In `src/cluster/usePhoneTrace.ts`, read `const fusedAltitude = useRecordingStore((s) => s.stats.altitudeM);`. Use `fusedAltitude` (not `position.altitudeM`) for the climb samples and for `altitudeM`.

- [ ] **Step 7: Run tests, typecheck, lint**

Run: `npx jest src/stores src/cluster src/tracking && npx tsc --noEmit && npx expo lint`
Expected: all pass, 0 lint errors.

- [ ] **Step 8: Commit**

```bash
git add src/stores/recordingStore.ts src/stores/__tests__/recordingStore.test.ts src/tracking/useBarometerFeed.ts src/tracking/useBarometerFeed.native.ts "src/app/(tabs)/_layout.tsx" src/app/cluster.tsx src/cluster/usePhoneTrace.ts
git commit -m "feat(v2): barometer elevation for live climb, saved routes and the Climb dial"
```

### Task 3: Cornering maths

**Files:**
- Create: `src/tracking/sensors/cornering.ts`
- Test: `src/tracking/sensors/__tests__/cornering.test.ts`

**Interfaces:**
- Produces: `yawRateRadS(rotationDegS: {alpha: number; beta: number; gamma: number}, gravity: {x: number; y: number; z: number}): number`; `lateralG(yawRadS: number, speedMps: number): number`; `CORNER_ENTER_G = 0.15`, `CORNER_EXIT_G = 0.08`; `type Corner = {peakG: number; at: number; latitude: number; longitude: number}`; `type CornerState = {inTurn: boolean; current: Corner | null; count: number; hardest: Corner | null}`; `EMPTY_CORNERS: CornerState`; `stepCorner(s: CornerState, g: number, at: number, where: {latitude: number; longitude: number} | null): CornerState`.

- [ ] **Step 1: Write the failing test**

```ts
import {CORNER_ENTER_G, EMPTY_CORNERS, lateralG, stepCorner, yawRateRadS} from '../cornering';

describe('cornering', () => {
  it('takes the turn rate about gravity, whatever way the phone is held', () => {
    // Phone flat (gravity along −z): yaw is rotation about z (gamma).
    expect(yawRateRadS({alpha: 0, beta: 0, gamma: 57.2958}, {x: 0, y: 0, z: -9.81})).toBeCloseTo(-1, 3);
    // Phone upright in a mount (gravity along −y): yaw is rotation about y (beta).
    expect(yawRateRadS({alpha: 0, beta: 28.6479, gamma: 0}, {x: 0, y: -9.81, z: 0})).toBeCloseTo(-0.5, 3);
  });

  it('turns turn rate and speed into sideways G', () => {
    // 0.2 rad/s at 20 m/s = 4 m/s² ≈ 0.41 g; the sign is dropped.
    expect(lateralG(-0.2, 20)).toBeCloseTo(0.408, 2);
    expect(lateralG(0.5, 0)).toBe(0);
  });

  it('keeps one peak per turn and the hardest corner of the drive', () => {
    let s = EMPTY_CORNERS;
    const gs = [0.05, 0.2, 0.32, 0.25, 0.05, 0.1, 0.18, 0.45, 0.2, 0.06];
    gs.forEach((g, i) => {
      s = stepCorner(s, g, i * 100, {latitude: i, longitude: 2});
    });
    expect(s.count).toBe(2);
    expect(s.hardest).toMatchObject({peakG: 0.45, at: 700, latitude: 7});
    expect(s.inTurn).toBe(false);
    expect(CORNER_ENTER_G).toBe(0.15);
    expect(stepCorner(EMPTY_CORNERS, 0.3, 0, null).current).toMatchObject({peakG: 0.3, latitude: NaN});
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/tracking/sensors/__tests__/cornering.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```ts
/**
 * Cornering force (spec 2026-10-25, telemetry sources, section 3): the car's turn rate times its
 * speed is the sideways acceleration felt in a corner. The turn rate is the phone's rotation about
 * gravity, so it reads the same whether the phone lies flat, stands in a mount or sits in a pocket.
 */

const G = 9.81;
const DEG = Math.PI / 180;

/** Rotation rate (DeviceMotion, °/s on x/y/z as alpha/beta/gamma) about the gravity axis, in rad/s. */
export const yawRateRadS = (r: {alpha: number; beta: number; gamma: number}, gravity: {x: number; y: number; z: number}): number => {
  const len = Math.hypot(gravity.x, gravity.y, gravity.z) || 1;
  return ((r.alpha * gravity.x + r.beta * gravity.y + r.gamma * gravity.z) / len) * DEG;
};

/** Sideways G in a turn: v·ω over g. Direction is not kept; a hard left counts like a hard right. */
export const lateralG = (yawRadS: number, speedMps: number): number => (speedMps <= 0 ? 0 : Math.abs(yawRadS * speedMps) / G);

/** A turn starts above this and ends below the lower line, so one corner isn't split by a wobble. */
export const CORNER_ENTER_G = 0.15;
export const CORNER_EXIT_G = 0.08;

export type Corner = {peakG: number; at: number; latitude: number; longitude: number};
export type CornerState = {inTurn: boolean; current: Corner | null; count: number; hardest: Corner | null};
export const EMPTY_CORNERS: CornerState = {inTurn: false, current: null, count: 0, hardest: null};

/** One lateral-G reading into the turn tracker: a turn's peak (and where it was), and the drive's hardest. */
export const stepCorner = (s: CornerState, g: number, at: number, where: {latitude: number; longitude: number} | null): CornerState => {
  const here = {latitude: where?.latitude ?? NaN, longitude: where?.longitude ?? NaN};
  if (!s.inTurn) {
    return g >= CORNER_ENTER_G ? {...s, inTurn: true, current: {peakG: g, at, ...here}} : s;
  }
  const current = s.current && g > s.current.peakG ? {peakG: g, at, ...here} : s.current;
  if (g >= CORNER_EXIT_G) {
    return {...s, current};
  }
  const hardest = current && (!s.hardest || current.peakG > s.hardest.peakG) ? current : s.hardest;
  return {inTurn: false, current: null, count: s.count + 1, hardest};
};
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx jest src/tracking/sensors/__tests__/cornering.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tracking/sensors/cornering.ts src/tracking/sensors/__tests__/cornering.test.ts
git commit -m "feat(v2): cornering force maths"
```

### Task 4: Roughness and phone-use maths, and the saved summary type

**Files:**
- Create: `src/tracking/sensors/roughness.ts`, `src/tracking/sensors/phoneUse.ts`, `src/tracking/sensors/types.ts`
- Test: `src/tracking/sensors/__tests__/roughness.test.ts`, `src/tracking/sensors/__tests__/phoneUse.test.ts`

**Interfaces:**
- Produces (roughness): `verticalAccel(acc: {x; y; z}, gravity: {x; y; z}): number`; `SEGMENT_M = 100`; `type RoadLevel = 'smooth' | 'fair' | 'rough'`; `roadLevel(rms: number): RoadLevel` (smooth < 0.6, fair < 1.4 m/s², else rough); `type RoughSegment = {latitude: number; longitude: number; rms: number; level: RoadLevel}`; `type RoughState = {startM: number | null; sumSq: number; n: number; segments: RoughSegment[]}`; `EMPTY_ROUGH`; `stepRough(s, vertical: number, distanceM: number, where: {latitude; longitude} | null): RoughState`; `roadSummary(segments): {smooth: number; fair: number; rough: number} | null` (shares 0–1).
- Produces (phone use): `PHONE_USE_MIN_MPS = 10 / 3.6`; `countsAsPhoneUse({appActive, pathname, speedMps, recording}): boolean` (false on `/drive`, `/telemetry`, `/cluster`); `addSeconds(total, from, to, maxGapS = 5): number`.
- Produces (types): `type TripSensors = {corners: {count: number; hardest: Corner | null}; road: {segments: RoughSegment[]; summary: {smooth: number; fair: number; rough: number} | null}; phoneUseS: number}`.

- [ ] **Step 1: Write the failing tests**

`roughness.test.ts`:
```ts
import {EMPTY_ROUGH, roadLevel, roadSummary, stepRough, verticalAccel} from '../roughness';

describe('road roughness', () => {
  it('takes the bump along gravity', () => {
    expect(verticalAccel({x: 0, y: 0, z: 2}, {x: 0, y: 0, z: -9.81})).toBeCloseTo(-2, 5);
    expect(verticalAccel({x: 0, y: 1.5, z: 0}, {x: 0, y: -9.81, z: 0})).toBeCloseTo(-1.5, 5);
  });

  it('buckets RMS vibration', () => {
    expect(roadLevel(0.3)).toBe('smooth');
    expect(roadLevel(1)).toBe('fair');
    expect(roadLevel(2)).toBe('rough');
  });

  it('closes a segment every 100 m with its RMS and where it ended', () => {
    let s = EMPTY_ROUGH;
    for (let d = 0; d <= 100; d += 10) {
      s = stepRough(s, d % 20 === 0 ? 2 : -2, d, {latitude: d, longitude: 0});
    }
    for (let d = 110; d <= 200; d += 10) {
      s = stepRough(s, 0.2, d, {latitude: d, longitude: 0});
    }
    expect(s.segments).toHaveLength(2);
    expect(s.segments[0]).toMatchObject({level: 'rough', latitude: 100});
    expect(s.segments[0].rms).toBeCloseTo(2, 5);
    expect(s.segments[1]).toMatchObject({level: 'smooth', latitude: 200});
    expect(roadSummary(s.segments)).toEqual({smooth: 0.5, fair: 0, rough: 0.5});
    expect(roadSummary([])).toBeNull();
  });
});
```

`phoneUse.test.ts`:
```ts
import {addSeconds, countsAsPhoneUse} from '../phoneUse';

describe('phone use while driving', () => {
  const base = {appActive: true, pathname: '/', speedMps: 15, recording: true};
  it('counts the app in use above 10 km/h, off the navigation screens', () => {
    expect(countsAsPhoneUse(base)).toBe(true);
    expect(countsAsPhoneUse({...base, pathname: '/drive'})).toBe(false);
    expect(countsAsPhoneUse({...base, pathname: '/telemetry'})).toBe(false);
    expect(countsAsPhoneUse({...base, pathname: '/cluster'})).toBe(false);
    expect(countsAsPhoneUse({...base, speedMps: 2})).toBe(false);
    expect(countsAsPhoneUse({...base, appActive: false})).toBe(false);
    expect(countsAsPhoneUse({...base, recording: false})).toBe(false);
  });

  it('adds whole seconds between ticks, skipping gaps (the app was away)', () => {
    expect(addSeconds(10, 1000, 2000)).toBe(11);
    expect(addSeconds(10, 1000, 60_000)).toBe(10);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest src/tracking/sensors`
Expected: FAIL on the two new files.

- [ ] **Step 3: Implement**

`roughness.ts`:
```ts
/**
 * Road roughness (spec 2026-10-25, telemetry sources, section 3): how much the car shakes up and
 * down, as the RMS of vertical acceleration over each 100 m, bucketed smooth / fair / rough.
 */

/** Gravity-free acceleration (DeviceMotion `acceleration`) along gravity: the up-and-down shake. */
export const verticalAccel = (acc: {x: number; y: number; z: number}, gravity: {x: number; y: number; z: number}): number => {
  const len = Math.hypot(gravity.x, gravity.y, gravity.z) || 1;
  return (acc.x * gravity.x + acc.y * gravity.y + acc.z * gravity.z) / len;
};

export const SEGMENT_M = 100;
export type RoadLevel = 'smooth' | 'fair' | 'rough';

/** RMS vertical shake (m/s²) to a level; set from typical phone readings on asphalt, worn and broken roads. */
export const roadLevel = (rms: number): RoadLevel => (rms < 0.6 ? 'smooth' : rms < 1.4 ? 'fair' : 'rough');

export type RoughSegment = {latitude: number; longitude: number; rms: number; level: RoadLevel};
export type RoughState = {startM: number | null; sumSq: number; n: number; segments: RoughSegment[]};
export const EMPTY_ROUGH: RoughState = {startM: null, sumSq: 0, n: 0, segments: []};

/** One vertical reading at a drive distance; every 100 m the segment closes where the car is. */
export const stepRough = (s: RoughState, vertical: number, distanceM: number, where: {latitude: number; longitude: number} | null): RoughState => {
  const startM = s.startM ?? distanceM;
  const next = {...s, startM, sumSq: s.sumSq + vertical * vertical, n: s.n + 1};
  if (distanceM - startM < SEGMENT_M || !where) {
    return next;
  }
  const rms = Math.sqrt(next.sumSq / next.n);
  return {startM: distanceM, sumSq: 0, n: 0, segments: [...s.segments, {...where, rms, level: roadLevel(rms)}]};
};

/** Shares of the drive's segments at each level; null with none. */
export const roadSummary = (segments: RoughSegment[]): {smooth: number; fair: number; rough: number} | null => {
  if (segments.length === 0) {
    return null;
  }
  const share = (level: RoadLevel) => segments.filter((x) => x.level === level).length / segments.length;
  return {smooth: share('smooth'), fair: share('fair'), rough: share('rough')};
};
```

`phoneUse.ts`:
```ts
/**
 * Phone use while driving (spec 2026-10-25, telemetry sources, section 3): the app open and the
 * screen unlocked while moving above 10 km/h, except on the screens used to drive with (Drive,
 * Telemetry and the cluster). Shown on Trip Detail; not part of the score.
 */

export const PHONE_USE_MIN_MPS = 10 / 3.6;
const NAVIGATION = ['/drive', '/telemetry', '/cluster'];

export const countsAsPhoneUse = (s: {appActive: boolean; pathname: string; speedMps: number; recording: boolean}): boolean =>
  s.recording && s.appActive && s.speedMps > PHONE_USE_MIN_MPS && !NAVIGATION.includes(s.pathname);

/** Seconds between two ticks added to the total; a long gap means the app was away and counts nothing. */
export const addSeconds = (total: number, fromMs: number, toMs: number, maxGapS = 5): number => {
  const s = (toMs - fromMs) / 1000;
  return s > 0 && s <= maxGapS ? total + s : total;
};
```

`types.ts`:
```ts
import type {Corner} from './cornering';
import type {RoughSegment} from './roughness';

/** A finished drive's phone-sensor summary, kept on the phone like its OBD data. */
export type TripSensors = {
  corners: {count: number; hardest: Corner | null};
  road: {segments: RoughSegment[]; summary: {smooth: number; fair: number; rough: number} | null};
  phoneUseS: number;
};
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx jest src/tracking/sensors`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tracking/sensors
git commit -m "feat(v2): road roughness and phone-use maths"
```

### Task 5: Drive store, storage and recorder

**Files:**
- Create: `src/stores/sensorDriveStore.ts`, `src/db/sensorRepos.ts`, `src/sync/sensorRecorder.ts`
- Modify: `src/db/schema.ts` (migration v7 + `TABLES`), `src/app/_layout.tsx` (start the recorder), `src/stores/finishedDriveStore.ts` (save at the end; delete on discard), `src/stores/tripDetailStore.ts` (delete with the trip)
- Test: `src/db/__tests__/sensorRepos.test.ts`, `src/stores/__tests__/sensorDriveStore.test.ts`

**Interfaces:**
- Consumes: Tasks 3–4.
- Produces: `useSensorDriveStore` with `{corners: CornerState; rough: RoughState; phoneUseS: number; addLateralG(g, at, where), addVertical(v, distanceM, where), addPhoneUse(fromMs, toMs), summary(): TripSensors | null, reset()}`. `summary()` is null when nothing was measured: no corners, no segments and no phone use. `putTripSensors(db, startedAt, value: TripSensors)`, `tripSensors(db, at): TripSensors | null` (±2 s match like `tripObd`), `deleteTripSensors(db, at)`. `startSensorRecorder(): () => void`.

Migration v7 (append to `MIGRATIONS`; never edit earlier entries):
```ts
  // v7 (phone sensors): each finished drive's cornering, road and phone-use summary, keyed by
  // start time like trip_obd.
  `
  CREATE TABLE trip_sensors (
    started_at INTEGER PRIMARY KEY,
    json TEXT NOT NULL
  );
  `,
```
and add `'trip_sensors'` to `TABLES`.

`sensorRepos.ts` mirrors `obdRepos.ts`'s `startKey` and `START_MATCH_MS` (2000 ms) matching.

`sensorRecorder.ts`: subscribe to `useRecordingStore`. While `status === 'recording'`, it writes `putTripSensors(db, startedAt, summary)` at most every 30 s when the summary is not null, so a crash keeps most of it. When the status leaves `recording` for `ready`, it does nothing (`finishedDriveStore` saves the final copy). Started in `src/app/_layout.tsx` right after `startObdRecorder()`, and stopped in the same cleanup.

`finishedDriveStore.show()`: after the OBD block (and inside its own try/catch, so it can never stop the drive saving), with a vehicle: `const s = useSensorDriveStore.getState().summary(); if (s) putTripSensors(db, drive.startedAt, s);`. Without a vehicle: `deleteTripSensors(db, drive.startedAt)`. Then always `useSensorDriveStore.getState().reset()`. `discard()` also calls `deleteTripSensors(db, drive.startedAt)` beside `deleteTripObd`. `tripDetailStore`'s delete calls `deleteTripSensors(db, Date.parse(start))` beside `deleteTripObd`.

The store also resets when a new drive starts: subscribe in `sensorRecorder` to a `ready` → `recording` change with a new `startedAt`, and call `reset()`.

- [ ] **Step 1: Write the failing tests**

`sensorRepos.test.ts`:
```ts
import {memoryDb} from '../../testUtils/memoryDb';
import {migrate} from '../schema';
import {deleteTripSensors, putTripSensors, tripSensors} from '../sensorRepos';

const T0 = 1_760_000_000_000;
const value = {corners: {count: 3, hardest: {peakG: 0.4, at: T0 + 5000, latitude: 1, longitude: 2}}, road: {segments: [], summary: null}, phoneUseS: 42};

describe('trip sensors storage', () => {
  it('stores a drive’s summary by start time and finds it within two seconds', () => {
    const db = memoryDb();
    migrate(db);
    putTripSensors(db, T0 + 0.6, value);
    expect(tripSensors(db, T0 + 1500)).toEqual(value);
    expect(tripSensors(db, T0 + 5000)).toBeNull();
    deleteTripSensors(db, T0);
    expect(tripSensors(db, T0)).toBeNull();
  });
});
```
(Use the same `memoryDb` import path that `src/db/__tests__/obdRepos.test.ts` uses.)

`sensorDriveStore.test.ts`:
```ts
import {useSensorDriveStore} from '../sensorDriveStore';

describe('sensor drive store', () => {
  beforeEach(() => useSensorDriveStore.getState().reset());

  it('builds the drive summary from corners, road and phone use', () => {
    const s = useSensorDriveStore.getState();
    expect(s.summary()).toBeNull();
    [0.05, 0.3, 0.05].forEach((g, i) => s.addLateralG(g, i * 100, {latitude: i, longitude: 0}));
    for (let d = 0; d <= 100; d += 10) {
      s.addVertical(0.1, d, {latitude: 5, longitude: 5});
    }
    s.addPhoneUse(0, 3000);
    const sum = useSensorDriveStore.getState().summary();
    expect(sum).toMatchObject({corners: {count: 1, hardest: {peakG: 0.3}}, road: {summary: {smooth: 1, fair: 0, rough: 0}}, phoneUseS: 3});
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest src/db/__tests__/sensorRepos.test.ts src/stores/__tests__/sensorDriveStore.test.ts`
Expected: FAIL, cannot find modules.

- [ ] **Step 3: Implement** the migration, repo, store (Zustand, in the style of `obdStore.ts`), recorder and the `finishedDriveStore` / `tripDetailStore` / `_layout` wiring as described.

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npx jest src/db src/stores && npx tsc --noEmit && npx expo lint`
Expected: all pass (the existing migration tests may count tables; update any that list `TABLES`).

- [ ] **Step 5: Commit**

```bash
git add src/stores/sensorDriveStore.ts src/db/sensorRepos.ts src/db/schema.ts src/sync/sensorRecorder.ts src/app/_layout.tsx src/stores/finishedDriveStore.ts src/stores/tripDetailStore.ts src/db/__tests__/sensorRepos.test.ts src/stores/__tests__/sensorDriveStore.test.ts
git commit -m "feat(v2): per-drive phone-sensor summary, stored on the phone"
```

### Task 6: Motion and phone-use feeds

**Files:**
- Create: `src/tracking/useDeviceMotionFeed.native.ts`, `src/tracking/useDeviceMotionFeed.ts`, `src/tracking/usePhoneUseFeed.ts`
- Modify: `src/app/(tabs)/_layout.tsx` (mount both while recording); `src/app/_layout.tsx` (mount `usePhoneUseFeed` at the root so it sees every route)

**Interfaces:**
- Consumes: `yawRateRadS`, `lateralG`, `verticalAccel` (Tasks 3–4); `useSensorDriveStore` (Task 5); `useRecordingStore` (`status`, `stats.speedMps`, `stats.distanceM`, `position`).

`useDeviceMotionFeed.native.ts` (10 Hz while `active`):
```ts
import {DeviceMotion} from 'expo-sensors';
import {useEffect} from 'react';
import {useRecordingStore} from '../stores/recordingStore';
import {useSensorDriveStore} from '../stores/sensorDriveStore';
import {lateralG, yawRateRadS} from './sensors/cornering';
import {verticalAccel} from './sensors/roughness';

const SAMPLE_MS = 100;

/**
 * Turn rate and vertical shake from the phone's fused motion sensor while recording (spec
 * 2026-10-25, telemetry sources, section 3): cornering G and road roughness. Gravity comes from the
 * same reading, so the phone can sit any way up.
 */
export function useDeviceMotionFeed(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    let sub: {remove: () => void} | null = null;
    let cancelled = false;
    DeviceMotion.isAvailableAsync()
      .then((ok) => {
        if (!ok || cancelled) {
          return;
        }
        DeviceMotion.setUpdateInterval(SAMPLE_MS);
        sub = DeviceMotion.addListener((m) => {
          const rec = useRecordingStore.getState();
          if (rec.status !== 'recording' || !m.acceleration || !m.rotationRate) {
            return;
          }
          const g = m.accelerationIncludingGravity;
          // Gravity alone: the reading with gravity minus the reading without it.
          const gravity = {x: g.x - m.acceleration.x, y: g.y - m.acceleration.y, z: g.z - m.acceleration.z};
          const where = rec.position ? {latitude: rec.position.latitude, longitude: rec.position.longitude} : null;
          const store = useSensorDriveStore.getState();
          store.addLateralG(lateralG(yawRateRadS(m.rotationRate, gravity), rec.stats.speedMps), Date.now(), where);
          store.addVertical(verticalAccel(m.acceleration, gravity), rec.stats.distanceM, where);
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [active]);
}
```
`useDeviceMotionFeed.ts` (web/default): `export function useDeviceMotionFeed(_active: boolean): void {}`.

`usePhoneUseFeed.ts`: uses `AppState` (`'active'` means foreground and unlocked) and `usePathname()`. A 1 s `setInterval` runs only while the app is active and recording. Each tick reads the stores and, when `countsAsPhoneUse(...)`, calls `addPhoneUse(lastTick, now)`; it always updates `lastTick`. Timers stop in the background, which is correct, because background time is never phone use.

- [ ] **Step 1: Implement the three hooks and mount them:** `useDeviceMotionFeed(recording)` next to `useMotionFeed(recording)` in the tabs layout, and `usePhoneUseFeed()` in the root layout's component body.
- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: 0 errors.
- [ ] **Step 3: Commit**

```bash
git add src/tracking/useDeviceMotionFeed.native.ts src/tracking/useDeviceMotionFeed.ts src/tracking/usePhoneUseFeed.ts "src/app/(tabs)/_layout.tsx" src/app/_layout.tsx
git commit -m "feat(v2): motion and phone-use feeds for the drive's sensor summary"
```

### Task 7: Trip Detail

**Files:**
- Create: `src/components/trip/RoadSection.tsx`, `src/hooks/useTripSensors.ts`
- Modify: `src/components/trip/GForceSummaryCard.tsx` (optional `corner` prop), `src/components/trip/TripRouteMap.types.ts` + `TripRouteMap.native.tsx` (optional `roughSpots`), `src/app/trip/[id].tsx`

**Interfaces:**
- Consumes: `tripSensors` (Task 5), `TripSensors` (Task 4).
- Produces: `useTripSensors(startTime: string | null): TripSensors | null` (reads the db once per start time, like `CarSection` does); `GForceSummaryCard` prop `corner?: number | null` (shows "Hardest corner · 0.42 g" when set); `TripRouteMapProps.roughSpots?: (LatLng & {level: 'fair' | 'rough'})[]`, drawn on native as `Circle`s with radius 14 m, amber for fair and red for rough, at 0.6 fill opacity; `RoadSection({sensors})` shows a three-part bar (smooth green / fair amber / rough red) with percentages, and "Phone use while moving · 1m 20s" when `phoneUseS ≥ 1`. It renders nothing when neither exists.

In `src/app/trip/[id].tsx`: `const sensors = useTripSensors(detail?.start_time ?? null)`. Pass `corner={sensors?.corners.hardest?.peakG ?? null}` to `GForceSummaryCard`, and `roughSpots={sensors?.road.segments.filter((s) => s.level !== 'smooth').map(...)}` to `TripRouteMap` (and the fullscreen map). Render `<RoadSection sensors={sensors} />` just above `<CarSection …/>`. Colours come from theme tokens (`c.green`, `c.amber`, `c.red`), not literals.

- [ ] **Step 1: Implement** the hook, card prop, map prop and section.
- [ ] **Step 2: Typecheck, lint, all tests**

Run: `npx tsc --noEmit && npx expo lint && npx jest`
Expected: 0 errors; all tests pass (including the token contract test).
- [ ] **Step 3: Quick Simulator check:** open a past drive in the Logbook and confirm Trip Detail renders. Drives recorded before this feature have no sensor summary, so the new rows and section are simply absent.
- [ ] **Step 4: Commit**

```bash
git add src/components/trip/RoadSection.tsx src/hooks/useTripSensors.ts src/components/trip/GForceSummaryCard.tsx src/components/trip/TripRouteMap.types.ts src/components/trip/TripRouteMap.native.tsx "src/app/trip/[id].tsx"
git commit -m "feat(v2): Trip Detail shows hardest corner, rough spots and phone use"
```

---

## Verification limits

The Simulator has no barometer or motion sensors, so Tasks 2 and 6 can only be checked by unit tests and by the feeds staying silent there. A real-phone drive is needed to tune the thresholds `CORNER_ENTER_G`, `roadLevel` and `BARO_HYSTERESIS_M`. Phone use can be checked in the Simulator by recording a simulated drive and opening the Logbook mid-drive.
