# Trip Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping a trip in Logbook opens a full trip page: speed-coloured route map, place card, hero, stat tiles, score and insights, speed chart, time at speed, elevation and stops, with a ⋯ menu (Share, Change vehicle, Delete).

**Architecture:** One request (`GET /api/v1/trips/{id}`) loads the trip with its GPS points, events and insights into a small Zustand store. Pure, tested helpers in `src/utils/tripAnalysis/` turn the points into segments, series, bands, stops and times. Presentational components in `src/components/trip/` draw each section; `src/app/trip/[id].tsx` composes them. The backend gains one endpoint, `PATCH /api/v1/trips/{id}`, to change a trip's vehicle.

**Tech Stack:** Expo SDK 57, Expo Router, React Native 0.86, TypeScript 6, Zustand, react-native-maps, react-native-svg, Jest (jest-expo). Backend: FastAPI, async SQLAlchemy, pytest (`asyncio_mode = auto`).

**Spec:** `docs/superpowers/specs/2026-10-13-mobile-v2-trip-detail-design.md`

## Global Constraints

- App code lives in `drive-sense-v2/`; run app commands from there. Backend code in `backend/`.
- Components and routes (`src/components/**`, `src/app/**`) must not contain raw colour literals (`'#…'`, `'rgb(…)'`); read colours from `useAppTheme()`. Enforced by `src/components/__tests__/tokenContract.test.ts`. Utilities in `src/utils/**` may compute colours.
- No new npm dependencies. Charts are hand-drawn with `react-native-svg`.
- Stop threshold: speed < 5 km/h. A stop lasts ≥ 30 s. Spike rule: reject a speed needing > 9 m/s² from the last trusted speed. Fast gap: ≤ 5 s. Ignored gap: > 600 s.
- Speed colour scale: 0 cyan · 25 green · 50 amber · 75 accent · 100+ red (km/h), interpolated in RGB.
- Time-at-speed bands (km/h): 0–20, 20–40, 40–60, 60–80, 80–100, 100+.
- Elevation: ignore `null` and exact `0` altitudes; gain/loss hysteresis 3 m.
- Night = local hour < 6 or ≥ 19, by trip start.
- Drawing limits: ≤ 500 map points, ≤ 200 chart samples.
- **Do not `git commit`.** The user commits themselves. Each task ends with a "Checkpoint" step instead (tests + typecheck green).
- Before declaring done: `npx tsc --noEmit`, `npx expo lint` (0 errors), `npx jest` all green; backend `cd backend && python -m pytest tests/unit -q` green.

---

## File map

| File | Responsibility |
|---|---|
| `backend/app/schemas/trip.py` | add `TripUpdateRequest` |
| `backend/app/services/trip_service.py` | add `update_trip_vehicle` |
| `backend/app/routers/trips.py` | add `PATCH /{trip_id}` |
| `backend/tests/unit/test_trip_update.py` | tests for `update_trip_vehicle` |
| `backend/tests/unit/test_app_routes.py` | assert PATCH route registered |
| `drive-sense-v2/src/services/tripService.ts` | full `TripDetail` type, `TripPoint`, `TripInsight`, `tripDetailApi.updateVehicle` |
| `drive-sense-v2/src/testUtils/mockApiClient.ts` | add `patch` |
| `drive-sense-v2/src/utils/speedColor.ts` | speed → colour |
| `drive-sense-v2/src/utils/tripAnalysis/prepare.ts` | clean, timed points + segments |
| `drive-sense-v2/src/utils/tripAnalysis/times.ts` | `tripTimes`, `timeAtSpeed` |
| `drive-sense-v2/src/utils/tripAnalysis/elevation.ts` | `elevationProfile` |
| `drive-sense-v2/src/utils/tripAnalysis/stops.ts` | `detectStops`, `dayPeriod` |
| `drive-sense-v2/src/utils/tripAnalysis/series.ts` | `thin`, `speedSegments`, `speedSeries` |
| `drive-sense-v2/src/utils/tripAnalysis/index.ts` | re-exports + `analyseTrip` |
| `drive-sense-v2/src/stores/tripDetailStore.ts` | load / cache / remove / changeVehicle |
| `drive-sense-v2/src/components/summary/Split.tsx` | hero split, extracted from `trip-summary.tsx` |
| `drive-sense-v2/src/components/drive/VehiclePickerSheet.tsx` | optional `onPick` + `selectedId` |
| `drive-sense-v2/src/components/trip/TripRouteMap{.tsx,.native.tsx,.web.tsx}` | speed-coloured map |
| `drive-sense-v2/src/components/trip/RouteFullscreen.tsx` | full-screen map modal |
| `drive-sense-v2/src/components/trip/PlaceCard.tsx` | start/end place + Day/Night |
| `drive-sense-v2/src/components/trip/SpeedChart.tsx` | speed over time |
| `drive-sense-v2/src/components/trip/TimeAtSpeedCard.tsx` | band bars |
| `drive-sense-v2/src/components/trip/ElevationCard.tsx` | elevation profile |
| `drive-sense-v2/src/components/trip/StopsCard.tsx` | stops list |
| `drive-sense-v2/src/components/trip/InsightsList.tsx` | server insights |
| `drive-sense-v2/src/components/trip/TripDetailSkeleton.tsx` | loading state |
| `drive-sense-v2/src/components/trip/SectionTitle.tsx` | icon + title section heading |
| `drive-sense-v2/src/app/trip/[id].tsx` | the page |
| `drive-sense-v2/src/app/_layout.tsx` | register `trip/[id]` |
| `drive-sense-v2/src/app/(tabs)/logbook.tsx` | cards open the page |
| `drive-sense-v2/src/app/trip-summary.tsx` | use extracted `Split` |

---

### Task 1: Backend — `PATCH /api/v1/trips/{trip_id}` (change vehicle)

**Files:**
- Modify: `backend/app/schemas/trip.py` (after `TripEndRequest`, ~line 23)
- Modify: `backend/app/services/trip_service.py` (after `delete_trip`, ~line 313)
- Modify: `backend/app/routers/trips.py` (imports line 14 and 18; new route after the DELETE route, ~line 157)
- Create: `backend/tests/unit/test_trip_update.py`
- Modify: `backend/tests/unit/test_app_routes.py`

**Interfaces:**
- Produces: `PATCH /api/v1/trips/{trip_id}` body `{"vehicle_id": "<uuid>"}` → 200 `TripRead`; 404 `{"detail": "Trip not found"}` or `{"detail": "Vehicle not found"}`.
- Produces: `async def update_trip_vehicle(db, *, user_id, trip_id, vehicle_id) -> Trip | None` (None = no such trip; raises `ValueError("Vehicle not found")` for a foreign vehicle).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/test_trip_update.py`:

```python
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.trip_service import update_trip_vehicle


def _result(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def _db(*results):
    db = MagicMock()
    db.execute = AsyncMock(side_effect=list(results))
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


async def test_moves_the_trip_to_another_owned_vehicle():
    new_vehicle = uuid.uuid4()
    trip = SimpleNamespace(vehicle_id=uuid.uuid4())
    # First query: the trip. Second: the ownership check on the vehicle.
    db = _db(_result(trip), _result(new_vehicle))
    updated = await update_trip_vehicle(db, user_id=uuid.uuid4(), trip_id=uuid.uuid4(), vehicle_id=new_vehicle)
    assert updated is trip
    assert trip.vehicle_id == new_vehicle
    db.commit.assert_awaited_once()


async def test_missing_or_foreign_trip_returns_none():
    db = _db(_result(None))
    assert await update_trip_vehicle(db, user_id=uuid.uuid4(), trip_id=uuid.uuid4(), vehicle_id=uuid.uuid4()) is None
    db.commit.assert_not_awaited()


async def test_foreign_vehicle_is_rejected():
    trip = SimpleNamespace(vehicle_id=uuid.uuid4())
    original = trip.vehicle_id
    db = _db(_result(trip), _result(None))
    with pytest.raises(ValueError, match="Vehicle not found"):
        await update_trip_vehicle(db, user_id=uuid.uuid4(), trip_id=uuid.uuid4(), vehicle_id=uuid.uuid4())
    assert trip.vehicle_id == original
    db.commit.assert_not_awaited()
```

Append to `test_app_routes.py` inside `test_app_builds_with_every_route`:

```python
    assert ("/api/v1/trips/{trip_id}", "PATCH") in paths
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/unit/test_trip_update.py tests/unit/test_app_routes.py -q`
Expected: FAIL — `ImportError: cannot import name 'update_trip_vehicle'`.

- [ ] **Step 3: Implement**

`backend/app/schemas/trip.py`, after `TripEndRequest`:

```python
class TripUpdateRequest(SchemaBase):
    vehicle_id: UUID
```

`backend/app/services/trip_service.py`, after `delete_trip`:

```python
async def update_trip_vehicle(
    db: AsyncSession, *, user_id: uuid.UUID, trip_id: uuid.UUID, vehicle_id: uuid.UUID
) -> Trip | None:
    """Move one of the user's trips to another of their vehicles. None when there is no such trip.

    Raises ValueError("Vehicle not found") when the vehicle is not the user's.
    """
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id, Trip.deleted_at.is_(None))
    )
    trip = result.scalar_one_or_none()
    if trip is None:
        return None
    await _ensure_vehicle_owned(db, user_id=user_id, vehicle_id=vehicle_id)
    trip.vehicle_id = vehicle_id
    await db.commit()
    await db.refresh(trip)
    return trip
```

`backend/app/routers/trips.py`: add `TripUpdateRequest` to the `app.schemas.trip` import and `update_trip_vehicle` to the `app.services.trip_service` import. After the DELETE route:

```python
@router.patch("/{trip_id}", response_model=TripRead)
async def update_trip_by_id(
    trip_id: UUID,
    payload: TripUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripRead:
    """Change the trip's vehicle. Owner only; 404 for a foreign trip or vehicle."""
    try:
        trip = await update_trip_vehicle(db, user_id=user.id, trip_id=trip_id, vehicle_id=payload.vehicle_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    return TripRead.model_validate(trip)
```

Check how the existing `/end` route builds its `TripRead` (`backend/app/routers/trips.py`, the `@router.post("/end"…)` handler). If it constructs `TripRead(...)` field by field instead of `model_validate`, do the same here so `distance_meters` etc. are converted identically.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/unit -q`
Expected: all pass (previous 82 + 3 new).

- [ ] **Step 5: Checkpoint** — backend unit suite green. Do not commit.

---

### Task 2: App service types, `updateVehicle`, mock `patch`

**Files:**
- Modify: `drive-sense-v2/src/services/tripService.ts:65-79`
- Modify: `drive-sense-v2/src/testUtils/mockApiClient.ts`
- Create: `drive-sense-v2/src/services/__tests__/tripDetailApi.test.ts`

**Interfaces:**
- Produces (exported from `src/services/tripService.ts`):

```ts
export type TripPoint = {
  recorded_at: string;
  latitude: number;
  longitude: number;
  speed_mps: number | null;
  altitude_m: number | null;
};
export type TripInsight = {rule_id: string; tone: 'info' | 'success' | 'warning' | string; title: string; message: string};
export type TripDetail = {
  id: string;
  vehicle_id: string;
  vehicle_name: string;
  start_time: string;
  end_time: string | null;
  distance_meters: number;
  duration_seconds: number;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  driving_score: number | null;
  idle_time_seconds: number;
  fuel_used_liters: number | null;
  max_g_force: number | null;
  max_g_source: string | null;
  left_turns: number | null;
  right_turns: number | null;
  start_address: string | null;
  end_address: string | null;
  location_points: TripPoint[];
  events: TripEvent[];
  insights: TripInsight[];
};
tripDetailApi.get(tripId: string): Promise<TripDetail>
tripDetailApi.updateVehicle(tripId: string, vehicleId: string): Promise<void>
```

- [ ] **Step 1: Write the failing test**

`src/services/__tests__/tripDetailApi.test.ts`:

```ts
import {mockedApiClient, resetApiClientMocks} from '../../testUtils/mockApiClient';
import {tripDetailApi} from '../tripService';

jest.mock('../apiClient', () => ({
  apiClient: {get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), patch: jest.fn()},
}));

describe('tripDetailApi', () => {
  beforeEach(resetApiClientMocks);

  it('patches the trip with the new vehicle', async () => {
    mockedApiClient.patch.mockResolvedValueOnce({data: {}});
    await tripDetailApi.updateVehicle('t1', 'v2');
    expect(mockedApiClient.patch).toHaveBeenCalledWith('/api/v1/trips/t1', {vehicle_id: 'v2'});
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd drive-sense-v2 && npx jest src/services/__tests__/tripDetailApi.test.ts`
Expected: FAIL — `patch` missing on the mock type / `updateVehicle` is not a function.

- [ ] **Step 3: Implement**

`src/testUtils/mockApiClient.ts`:

```ts
type MockableApiClient = Pick<typeof apiClient, 'delete' | 'get' | 'patch' | 'post' | 'put'>;
```

and in `resetApiClientMocks` add `mockedApiClient.patch.mockReset();`.

`src/services/tripService.ts`: replace the `TripDetail` type and `tripDetailApi` (lines 65–79) with the types in **Interfaces** above, and:

```ts
export const tripDetailApi = {
  get: async (tripId: string): Promise<TripDetail> => (await apiClient.get<TripDetail>(`/api/v1/trips/${tripId}`)).data,
  /** Move the trip to another of the user's vehicles. */
  updateVehicle: async (tripId: string, vehicleId: string): Promise<void> => {
    await apiClient.patch(`/api/v1/trips/${tripId}`, {vehicle_id: vehicleId});
  },
};
```

Keep the doc comment above `TripDetail` as "The parts of `GET /trips/{id}` the app uses."

- [ ] **Step 4: Run tests + typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: all pass. If any existing test builds a `TripDetail` literal and now fails typecheck, add the missing fields to that fixture (do not loosen the type).

- [ ] **Step 5: Checkpoint.**

---

### Task 3: `speedColor`

**Files:**
- Create: `drive-sense-v2/src/utils/speedColor.ts`
- Test: `drive-sense-v2/src/utils/__tests__/speedColor.test.ts`

**Interfaces:**
- Produces:

```ts
export type SpeedScaleColors = {cyan: string; green: string; amber: string; accent: string; red: string};
export const SPEED_SCALE_KMH: readonly number[]; // [0, 25, 50, 75, 100]
export const speedColor: (kmh: number, colors: SpeedScaleColors) => string; // '#rrggbb'
export const speedScaleStops: (colors: SpeedScaleColors) => {kmh: number; color: string}[];
```

- [ ] **Step 1: Write the failing test**

```ts
import {speedColor, speedScaleStops} from '../speedColor';

const colors = {cyan: '#000000', green: '#640000', amber: '#C80000', accent: '#FF0000', red: '#FFFFFF'};

describe('speedColor', () => {
  it('returns the stop colour exactly at a stop', () => {
    expect(speedColor(0, colors)).toBe('#000000');
    expect(speedColor(50, colors)).toBe('#c80000');
  });

  it('interpolates between stops', () => {
    // halfway between #000000 (0) and #640000 (25): red channel 50 = 0x32
    expect(speedColor(12.5, colors)).toBe('#320000');
  });

  it('clamps below 0 and above 100', () => {
    expect(speedColor(-10, colors)).toBe('#000000');
    expect(speedColor(180, colors)).toBe('#ffffff');
  });

  it('falls back to the lower stop when a colour is not hex', () => {
    expect(speedColor(10, {...colors, green: 'rgba(0,0,0,0.5)'})).toBe('#000000');
  });

  it('lists the scale stops for a legend', () => {
    expect(speedScaleStops(colors).map((s) => s.kmh)).toEqual([0, 25, 50, 75, 100]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/utils/__tests__/speedColor.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** `src/utils/speedColor.ts`:

```ts
/**
 * Speed → colour on the trip page: one continuous scale shared by the route, the legend and the
 * speed chart, built from theme tokens so it follows Light / Dark.
 */
export type SpeedScaleColors = {cyan: string; green: string; amber: string; accent: string; red: string};

export const SPEED_SCALE_KMH = [0, 25, 50, 75, 100] as const;

const stopColors = (c: SpeedScaleColors) => [c.cyan, c.green, c.amber, c.accent, c.red];

const parseHex = (hex: string): [number, number, number] | null => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) {
    return null;
  }
  const h = m[1].length === 3 ? m[1].replace(/./g, (ch) => ch + ch) : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export const speedColor = (kmh: number, colors: SpeedScaleColors): string => {
  const stops = stopColors(colors);
  const last = SPEED_SCALE_KMH.length - 1;
  if (!(kmh > SPEED_SCALE_KMH[0])) {
    return parseHex(stops[0]) ? toHex(parseHex(stops[0])!) : stops[0];
  }
  if (kmh >= SPEED_SCALE_KMH[last]) {
    return parseHex(stops[last]) ? toHex(parseHex(stops[last])!) : stops[last];
  }
  let i = 0;
  while (kmh >= SPEED_SCALE_KMH[i + 1]) {
    i += 1;
  }
  const a = parseHex(stops[i]);
  const b = parseHex(stops[i + 1]);
  if (!a || !b) {
    return a ? toHex(a) : stops[i];
  }
  const f = (kmh - SPEED_SCALE_KMH[i]) / (SPEED_SCALE_KMH[i + 1] - SPEED_SCALE_KMH[i]);
  return toHex(a.map((v, k) => v + (b[k] - v) * f));
};

export const speedScaleStops = (colors: SpeedScaleColors) =>
  SPEED_SCALE_KMH.map((kmh) => ({kmh, color: speedColor(kmh, colors)}));
```

- [ ] **Step 4: Run** `npx jest src/utils/__tests__/speedColor.test.ts` → PASS.

- [ ] **Step 5: Checkpoint.**

---

### Task 4: `prepare` — clean timed points and segments

**Files:**
- Create: `drive-sense-v2/src/utils/tripAnalysis/prepare.ts`
- Create: `drive-sense-v2/src/utils/tripAnalysis/__tests__/fixtures.ts` (shared test helper)
- Test: `drive-sense-v2/src/utils/tripAnalysis/__tests__/prepare.test.ts`

**Interfaces:**
- Consumes: `TripPoint` from `src/services/tripService.ts`; `haversineMeters` from `src/utils/geo.ts`.
- Produces:

```ts
export const STOPPED_KMH = 5;
export const FAST_GAP_S = 5;
export const MAX_GAP_S = 600;
export const MAX_ACCEL_MPS2 = 9;
export interface CleanPoint {t: number; latitude: number; longitude: number; mps: number; altitude: number | null}
export interface Segment {from: CleanPoint; to: CleanPoint; seconds: number; meters: number; kmh: number}
export const cleanPoints: (points: TripPoint[]) => CleanPoint[];
export const segments: (points: CleanPoint[]) => Segment[];
```

- [ ] **Step 1: Write the fixture and the failing test**

`src/utils/tripAnalysis/__tests__/fixtures.ts` (Jest only runs `*.test.ts`, so this file is not a suite):

```ts
import type {TripPoint} from '../../../services/tripService';

/** A point `s` seconds after a fixed start, `m` metres north of the origin. */
export const pt = (s: number, m: number, speed: number | null = null, alt: number | null = null): TripPoint => ({
  recorded_at: new Date(Date.UTC(2026, 9, 11, 14, 0, 0) + s * 1000).toISOString(),
  latitude: 28.6 + m / 111_195,
  longitude: 77.2,
  speed_mps: speed,
  altitude_m: alt,
});
```

`src/utils/tripAnalysis/__tests__/prepare.test.ts`:

```ts
import {cleanPoints, segments} from '../prepare';
import {pt} from './fixtures';

describe('cleanPoints', () => {
  it('sorts by time and drops unparseable timestamps', () => {
    const out = cleanPoints([pt(2, 20, 10), {...pt(1, 10, 10), recorded_at: 'nope'}, pt(0, 0, 10)]);
    expect(out.map((p) => p.t - out[0].t)).toEqual([0, 2000]);
  });

  it('uses GPS speed when present, otherwise distance over time', () => {
    const out = cleanPoints([pt(0, 0, null), pt(2, 20, null)]);
    expect(out[1].mps).toBeCloseTo(10, 1);
  });

  it('replaces a spike with the last trusted speed, and trusts the reading after it', () => {
    const out = cleanPoints([pt(0, 0, 10), pt(1, 10, 40), pt(2, 20, 11)]);
    expect(out.map((p) => p.mps)).toEqual([10, 10, 11]);
  });

  it('keeps null and zero altitudes as null', () => {
    const out = cleanPoints([pt(0, 0, 1, 0), pt(1, 1, 1, null), pt(2, 2, 1, 210)]);
    expect(out.map((p) => p.altitude)).toEqual([null, null, 210]);
  });
});

describe('segments', () => {
  it('uses the first point speed across a short gap', () => {
    const [seg] = segments(cleanPoints([pt(0, 0, 10), pt(2, 20, 12)]));
    expect(seg.kmh).toBeCloseTo(36);
    expect(seg.seconds).toBe(2);
    expect(seg.meters).toBeCloseTo(20, 0);
  });

  it('uses distance over time across a long gap (stopped at a light)', () => {
    const [seg] = segments(cleanPoints([pt(0, 0, 8), pt(60, 5, 8)]));
    expect(seg.kmh).toBeLessThan(5);
  });

  it('drops gaps over ten minutes (a paused drive)', () => {
    expect(segments(cleanPoints([pt(0, 0, 10), pt(700, 10, 10)]))).toEqual([]);
  });
});
```

Also add a case proving one spike does not poison the rest (the trusted window widens with time):

```ts
  it('accepts a real speed-up after a rejected reading', () => {
    // standing, then 10 m/s: the first 10 is a 10 m/s² jump in 1 s (rejected), the next is 10 over 2 s (kept)
    const out = cleanPoints([pt(0, 0, 0), pt(1, 0, 0), pt(2, 10, 10), pt(3, 20, 10), pt(4, 30, 10)]);
    expect(out.map((p) => p.mps)).toEqual([0, 0, 0, 10, 10]);
  });
```

- [ ] **Step 2: Run** `npx jest src/utils/tripAnalysis` → FAIL (module not found).

- [ ] **Step 3: Implement** `src/utils/tripAnalysis/prepare.ts`:

```ts
import type {TripPoint} from '../../services/tripService';
import {haversineMeters} from '../geo';

/** Below this the car counts as stopped (same as the Drive page). */
export const STOPPED_KMH = 5;
/** Gaps up to this long are steady GPS: the first point's own speed holds across them. */
export const FAST_GAP_S = 5;
/** Longer gaps are a paused drive, not driving or idling. */
export const MAX_GAP_S = 600;
/** A speed change needing more than this is a GPS spike (≈ 0.9 g; same rule as recording). */
export const MAX_ACCEL_MPS2 = 9;

export interface CleanPoint {
  t: number;
  latitude: number;
  longitude: number;
  mps: number;
  altitude: number | null;
}

export interface Segment {
  from: CleanPoint;
  to: CleanPoint;
  seconds: number;
  meters: number;
  kmh: number;
}

/** Timed points in order, with a trustworthy speed each. */
export const cleanPoints = (points: TripPoint[]): CleanPoint[] => {
  const timed = points
    .map((p) => ({p, t: Date.parse(p.recorded_at)}))
    .filter(({t}) => Number.isFinite(t))
    .sort((a, b) => a.t - b.t);

  const out: CleanPoint[] = [];
  // The last speed we believed and when: a spike is judged against it over the whole time since,
  // so one rejected reading cannot lock out a real speed-up that follows.
  let trusted: {mps: number; t: number} | null = null;
  for (const {p, t} of timed) {
    const prev = out[out.length - 1];
    const dt = prev ? (t - prev.t) / 1000 : 0;
    let mps = p.speed_mps != null && p.speed_mps >= 0 ? p.speed_mps : prev && dt > 0 ? haversineMeters(prev, p) / dt : 0;
    const since = trusted ? (t - trusted.t) / 1000 : 0;
    if (trusted && since > 0 && Math.abs(mps - trusted.mps) / since > MAX_ACCEL_MPS2) {
      mps = trusted.mps;
    } else {
      trusted = {mps, t};
    }
    out.push({
      t,
      latitude: p.latitude,
      longitude: p.longitude,
      mps,
      altitude: p.altitude_m != null && p.altitude_m !== 0 ? p.altitude_m : null,
    });
  }
  return out;
};

/**
 * Consecutive pairs. Background GPS only reports after 2 m of movement, so a standing car leaves
 * a long gap: across one, speed is distance ÷ time (a red light reads as stopped, a dropout on a
 * highway as moving).
 */
export const segments = (points: CleanPoint[]): Segment[] => {
  const out: Segment[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    const seconds = (to.t - from.t) / 1000;
    if (seconds <= 0 || seconds > MAX_GAP_S) {
      continue;
    }
    const meters = haversineMeters(from, to);
    const mps = seconds <= FAST_GAP_S ? from.mps : meters / seconds;
    out.push({from, to, seconds, meters, kmh: mps * 3.6});
  }
  return out;
};
```

- [ ] **Step 4: Run** `npx jest src/utils/tripAnalysis` → PASS.

- [ ] **Step 5: Checkpoint.**

---

### Task 5: `tripTimes` and `timeAtSpeed`

**Files:**
- Create: `drive-sense-v2/src/utils/tripAnalysis/times.ts`
- Test: `drive-sense-v2/src/utils/tripAnalysis/__tests__/times.test.ts`

**Interfaces:**
- Consumes: `Segment`, `STOPPED_KMH` from `./prepare`.
- Produces:

```ts
export const SPEED_BANDS: {label: string; min: number; max: number}[]; // km/h, max Infinity for 100+
export interface TripTimes {movingS: number; idleS: number}
export interface SpeedBand {label: string; seconds: number; meters: number; share: number}
export const tripTimes: (segs: Segment[]) => TripTimes;
export const timeAtSpeed: (segs: Segment[]) => SpeedBand[]; // all 6 bands, share of moving time (0..1)
```

- [ ] **Step 1: Write the failing test**

```ts
import {cleanPoints, segments} from '../prepare';
import {timeAtSpeed, tripTimes} from '../times';
import {pt} from './fixtures';

// 10 s at 36 km/h, then a 60 s stop with no points, then 10 s at 90 km/h.
const route = () =>
  segments(
    cleanPoints([
      ...Array.from({length: 11}, (_, i) => pt(i, i * 10, 10)),
      ...Array.from({length: 11}, (_, i) => pt(70 + i, 100 + i * 25, 25)),
    ]),
  );

describe('tripTimes', () => {
  it('splits moving and idle time', () => {
    const t = tripTimes(route());
    expect(t.movingS).toBe(20);
    expect(t.idleS).toBe(60);
  });

  it('is zero for no segments', () => {
    expect(tripTimes([])).toEqual({movingS: 0, idleS: 0});
  });
});

describe('timeAtSpeed', () => {
  it('puts moving time into bands with shares of moving time', () => {
    const bands = timeAtSpeed(route());
    expect(bands.map((b) => b.label)).toEqual(['0–20', '20–40', '40–60', '60–80', '80–100', '100+']);
    expect(bands[1].seconds).toBe(10);
    expect(bands[4].seconds).toBe(10);
    expect(bands[1].share).toBeCloseTo(0.5);
    expect(bands[0].seconds).toBe(0); // the stop is not driving
  });

  it('returns zero shares with no movement', () => {
    expect(timeAtSpeed([]).every((b) => b.share === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `times.ts`:

```ts
import {STOPPED_KMH, type Segment} from './prepare';

export const SPEED_BANDS = [
  {label: '0–20', min: 0, max: 20},
  {label: '20–40', min: 20, max: 40},
  {label: '40–60', min: 40, max: 60},
  {label: '60–80', min: 60, max: 80},
  {label: '80–100', min: 80, max: 100},
  {label: '100+', min: 100, max: Infinity},
];

export interface TripTimes {
  movingS: number;
  idleS: number;
}

export interface SpeedBand {
  label: string;
  seconds: number;
  meters: number;
  /** Share of moving time, 0..1. */
  share: number;
}

const moving = (s: Segment) => s.kmh >= STOPPED_KMH;

export const tripTimes = (segs: Segment[]): TripTimes =>
  segs.reduce(
    (acc, s) => (moving(s) ? {...acc, movingS: acc.movingS + s.seconds} : {...acc, idleS: acc.idleS + s.seconds}),
    {movingS: 0, idleS: 0},
  );

export const timeAtSpeed = (segs: Segment[]): SpeedBand[] => {
  const bands = SPEED_BANDS.map((b) => ({label: b.label, seconds: 0, meters: 0, share: 0}));
  let total = 0;
  for (const s of segs) {
    if (!moving(s)) {
      continue;
    }
    const i = SPEED_BANDS.findIndex((b) => s.kmh >= b.min && s.kmh < b.max);
    bands[i].seconds += s.seconds;
    bands[i].meters += s.meters;
    total += s.seconds;
  }
  return bands.map((b) => ({...b, share: total > 0 ? b.seconds / total : 0}));
};
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Checkpoint.**

---

### Task 6: `elevationProfile`

**Files:**
- Create: `drive-sense-v2/src/utils/tripAnalysis/elevation.ts`
- Test: `drive-sense-v2/src/utils/tripAnalysis/__tests__/elevation.test.ts`

**Interfaces:**
- Consumes: `CleanPoint` from `./prepare`; `thin` from `./series` (Task 8) — to keep tasks independent, `elevation.ts` imports `thin` from `./thin` (created here).
- Produces:

```ts
// src/utils/tripAnalysis/thin.ts
export const thin: <T>(items: T[], max: number) => T[]; // keeps first and last, evenly spaced
// src/utils/tripAnalysis/elevation.ts
export const ELEVATION_STEP_M = 3;
export interface ElevationProfile {series: {t: number; m: number}[]; gainM: number; lossM: number; maxM: number; minM: number}
export const elevationProfile: (points: CleanPoint[], maxSamples?: number) => ElevationProfile | null;
```

- [ ] **Step 1: Write the failing tests**

`__tests__/thin.test.ts`:

```ts
import {thin} from '../thin';

describe('thin', () => {
  it('returns the input when already small enough', () => {
    expect(thin([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });

  it('keeps first and last and spaces the rest evenly', () => {
    const out = thin(Array.from({length: 101}, (_, i) => i), 5);
    expect(out).toEqual([0, 25, 50, 75, 100]);
  });
});
```

`__tests__/elevation.test.ts`:

```ts
import {elevationProfile} from '../elevation';
import {cleanPoints} from '../prepare';
import {pt} from './fixtures';

describe('elevationProfile', () => {
  it('is null with fewer than two real altitudes', () => {
    expect(elevationProfile(cleanPoints([pt(0, 0, 1, 0), pt(1, 1, 1, 210)]))).toBeNull();
  });

  it('counts climb and drop, ignoring jitter under 3 m', () => {
    const alts = [200, 201, 199, 200, 210, 211, 205, 204];
    const p = elevationProfile(cleanPoints(alts.map((a, i) => pt(i, i * 10, 10, a))))!;
    // ref 200; 201/199/200 within 3 m; 210 → +10 (ref 210); 211 within; 205 → −5 (ref 205); 204 within
    expect(p.gainM).toBe(10);
    expect(p.lossM).toBe(5);
    expect(p.maxM).toBe(211);
    expect(p.minM).toBe(199);
  });

  it('caps the series length', () => {
    const p = elevationProfile(cleanPoints(Array.from({length: 1000}, (_, i) => pt(i, i, 10, 200 + (i % 7)))), 200)!;
    expect(p.series).toHaveLength(200);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`thin.ts`:

```ts
/** At most `max` items, evenly spaced, always keeping the first and the last. */
export const thin = <T>(items: T[], max: number): T[] => {
  if (items.length <= max || max < 2) {
    return items;
  }
  const step = (items.length - 1) / (max - 1);
  return Array.from({length: max}, (_, i) => items[Math.round(i * step)]);
};
```

`elevation.ts`:

```ts
import type {CleanPoint} from './prepare';
import {thin} from './thin';

/** Altitude changes smaller than this are GPS wobble, not climbing. */
export const ELEVATION_STEP_M = 3;

export interface ElevationProfile {
  series: {t: number; m: number}[];
  gainM: number;
  lossM: number;
  maxM: number;
  minM: number;
}

export const elevationProfile = (points: CleanPoint[], maxSamples = 200): ElevationProfile | null => {
  const valid = points.filter((p): p is CleanPoint & {altitude: number} => p.altitude != null);
  if (valid.length < 2) {
    return null;
  }
  let ref = valid[0].altitude;
  let gainM = 0;
  let lossM = 0;
  for (const p of valid) {
    const diff = p.altitude - ref;
    if (diff >= ELEVATION_STEP_M) {
      gainM += diff;
      ref = p.altitude;
    } else if (diff <= -ELEVATION_STEP_M) {
      lossM -= diff;
      ref = p.altitude;
    }
  }
  const alts = valid.map((p) => p.altitude);
  return {
    series: thin(valid, maxSamples).map((p) => ({t: p.t, m: p.altitude})),
    gainM: Math.round(gainM),
    lossM: Math.round(lossM),
    maxM: Math.max(...alts),
    minM: Math.min(...alts),
  };
};
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Checkpoint.**

---

### Task 7: `detectStops` and `dayPeriod`

**Files:**
- Create: `drive-sense-v2/src/utils/tripAnalysis/stops.ts`
- Test: `drive-sense-v2/src/utils/tripAnalysis/__tests__/stops.test.ts`

**Interfaces:**
- Consumes: `Segment`, `STOPPED_KMH` from `./prepare`.
- Produces:

```ts
export const MIN_STOP_S = 30;
export interface Stop {startedAt: number; durationS: number; latitude: number; longitude: number}
export const detectStops: (segs: Segment[]) => Stop[];
export type DayPeriod = 'day' | 'night';
export const dayPeriod: (startIso: string) => DayPeriod;
```

- [ ] **Step 1: Write the failing test**

```ts
import {cleanPoints, segments} from '../prepare';
import {dayPeriod, detectStops} from '../stops';
import {pt} from './fixtures';

/** Each leg: [startSecond, count, speed m/s]; points 1 s apart, each leg continuing where the last ended. */
const drive = (...legs: [number, number, number][]) => {
  let pos = 0;
  const points = legs.flatMap(([start, count, speed]) =>
    Array.from({length: count}, (_, i) => {
      const p = pt(start + i, pos, speed);
      pos += speed;
      return p;
    }),
  );
  return segments(cleanPoints(points));
};

describe('detectStops', () => {
  it('finds a stop of 30 s or more between moving stretches', () => {
    const stops = detectStops(drive([0, 10, 10], [40, 10, 10]));
    expect(stops).toHaveLength(1);
    expect(stops[0].durationS).toBeGreaterThanOrEqual(30);
  });

  it('ignores short stops', () => {
    // a 20 s gap is too short to count
    expect(detectStops(drive([0, 10, 10], [29, 10, 10]))).toEqual([]);
  });

  it('ignores standing still at the very start or end', () => {
    expect(detectStops(drive([0, 40, 0], [40, 10, 10], [50, 40, 0]))).toEqual([]);
  });
});

describe('dayPeriod', () => {
  it('is night before 06:00 and from 19:00, local time', () => {
    expect(dayPeriod(new Date(2026, 9, 11, 20, 0).toISOString())).toBe('night');
    expect(dayPeriod(new Date(2026, 9, 11, 5, 59).toISOString())).toBe('night');
    expect(dayPeriod(new Date(2026, 9, 11, 12, 0).toISOString())).toBe('day');
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `stops.ts`:

```ts
import {STOPPED_KMH, type Segment} from './prepare';

/** Shorter halts (a slow crawl, a give-way) are not worth listing. */
export const MIN_STOP_S = 30;

export interface Stop {
  startedAt: number;
  durationS: number;
  latitude: number;
  longitude: number;
}

/** Runs of stopped segments of 30 s or more. Waiting at the start or end of a trip is not a stop. */
export const detectStops = (segs: Segment[]): Stop[] => {
  const stops: Stop[] = [];
  let i = 0;
  while (i < segs.length) {
    if (segs[i].kmh >= STOPPED_KMH) {
      i += 1;
      continue;
    }
    const first = i;
    let durationS = 0;
    while (i < segs.length && segs[i].kmh < STOPPED_KMH) {
      durationS += segs[i].seconds;
      i += 1;
    }
    const touchesEdge = first === 0 || i === segs.length;
    if (!touchesEdge && durationS >= MIN_STOP_S) {
      const at = segs[first].from;
      stops.push({startedAt: at.t, durationS, latitude: at.latitude, longitude: at.longitude});
    }
  }
  return stops;
};

export type DayPeriod = 'day' | 'night';

export const dayPeriod = (startIso: string): DayPeriod => {
  const hour = new Date(startIso).getHours();
  return hour < 6 || hour >= 19 ? 'night' : 'day';
};
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Checkpoint.**

---

### Task 8: `speedSegments`, `speedSeries`, `analyseTrip`

**Files:**
- Create: `drive-sense-v2/src/utils/tripAnalysis/series.ts`
- Create: `drive-sense-v2/src/utils/tripAnalysis/index.ts`
- Test: `drive-sense-v2/src/utils/tripAnalysis/__tests__/series.test.ts`

**Interfaces:**
- Consumes: `cleanPoints`, `segments`, `CleanPoint` (Task 4); `tripTimes`, `timeAtSpeed` (Task 5); `elevationProfile`, `thin` (Task 6); `detectStops` (Task 7); `speedColor`, `SpeedScaleColors` (Task 3); `TripPoint` (Task 2).
- Produces:

```ts
export const MAP_POINTS = 500;
export const CHART_SAMPLES = 200;
export interface ColoredLine {key: string; color: string; coords: {latitude: number; longitude: number}[]}
export const speedSegments: (points: CleanPoint[], colors: SpeedScaleColors, max?: number) => ColoredLine[];
export interface SpeedSample {t: number; kmh: number}
export const speedSeries: (points: CleanPoint[], max?: number) => {samples: SpeedSample[]; peak: SpeedSample | null};
// index.ts
export interface TripAnalysis {
  points: CleanPoint[];
  route: {latitude: number; longitude: number}[];
  times: TripTimes;
  bands: SpeedBand[];
  elevation: ElevationProfile | null;
  stops: Stop[];
  speed: {samples: SpeedSample[]; peak: SpeedSample | null};
}
export const analyseTrip: (points: TripPoint[]) => TripAnalysis;
// plus re-exports of every public name from prepare, times, elevation, stops, series, thin
```

- [ ] **Step 1: Write the failing test**

```ts
import {analyseTrip} from '..';
import {cleanPoints} from '../prepare';
import {speedSegments, speedSeries} from '../series';
import {pt} from './fixtures';

const colors = {cyan: '#000000', green: '#640000', amber: '#C80000', accent: '#FF0000', red: '#FFFFFF'};

describe('speedSegments', () => {
  it('merges neighbours of the same colour bucket and joins lines end to start', () => {
    const pts = cleanPoints([...Array.from({length: 5}, (_, i) => pt(i, i * 10, 10)), ...Array.from({length: 5}, (_, i) => pt(5 + i, 50 + i * 25, 25))]);
    const lines = speedSegments(pts, colors);
    expect(lines.length).toBe(2);
    expect(lines[0].coords[lines[0].coords.length - 1]).toEqual(lines[1].coords[0]);
  });

  it('is empty for fewer than two points', () => {
    expect(speedSegments(cleanPoints([pt(0, 0, 10)]), colors)).toEqual([]);
  });
});

describe('speedSeries', () => {
  it('caps samples and always keeps the peak', () => {
    const pts = cleanPoints(Array.from({length: 1000}, (_, i) => pt(i, i * 10, i === 333 ? 10.5 : 10)));
    const {samples, peak} = speedSeries(pts, 50);
    expect(samples.length).toBeLessThanOrEqual(51);
    expect(peak!.kmh).toBeCloseTo(37.8);
    expect(samples.some((s) => s.t === peak!.t)).toBe(true);
  });
});

describe('analyseTrip', () => {
  it('handles a trip with no points', () => {
    const a = analyseTrip([]);
    expect(a.route).toEqual([]);
    expect(a.elevation).toBeNull();
    expect(a.stops).toEqual([]);
    expect(a.speed.peak).toBeNull();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`series.ts`:

```ts
import {speedColor, type SpeedScaleColors} from '../speedColor';
import {segments, type CleanPoint} from './prepare';
import {thin} from './thin';

export const MAP_POINTS = 500;
export const CHART_SAMPLES = 200;
/** Speeds within the same 5 km/h step share a colour, so the route draws as a few long lines. */
const BUCKET_KMH = 5;

export interface ColoredLine {
  key: string;
  color: string;
  coords: {latitude: number; longitude: number}[];
}

export const speedSegments = (points: CleanPoint[], colors: SpeedScaleColors, max = MAP_POINTS): ColoredLine[] => {
  const segs = segments(thin(points, max));
  const lines: ColoredLine[] = [];
  let bucket: number | null = null;
  for (const s of segs) {
    const b = Math.floor(s.kmh / BUCKET_KMH);
    const to = {latitude: s.to.latitude, longitude: s.to.longitude};
    if (b === bucket && lines.length > 0) {
      lines[lines.length - 1].coords.push(to);
    } else {
      bucket = b;
      lines.push({
        key: `${lines.length}`,
        color: speedColor(b * BUCKET_KMH + BUCKET_KMH / 2, colors),
        coords: [{latitude: s.from.latitude, longitude: s.from.longitude}, to],
      });
    }
  }
  return lines;
};

export interface SpeedSample {
  t: number;
  kmh: number;
}

export const speedSeries = (points: CleanPoint[], max = CHART_SAMPLES): {samples: SpeedSample[]; peak: SpeedSample | null} => {
  const all = points.map((p) => ({t: p.t, kmh: p.mps * 3.6}));
  if (all.length === 0) {
    return {samples: [], peak: null};
  }
  const peak = all.reduce((best, s) => (s.kmh > best.kmh ? s : best), all[0]);
  const samples = thin(all, max);
  if (!samples.includes(peak)) {
    samples.push(peak);
    samples.sort((a, b) => a.t - b.t);
  }
  return {samples, peak};
};
```

`index.ts`:

```ts
import type {TripPoint} from '../../services/tripService';
import {elevationProfile, type ElevationProfile} from './elevation';
import {cleanPoints, segments, type CleanPoint} from './prepare';
import {speedSeries, type SpeedSample} from './series';
import {detectStops, type Stop} from './stops';
import {thin} from './thin';
import {timeAtSpeed, tripTimes, type SpeedBand, type TripTimes} from './times';
import {MAP_POINTS} from './series';

export * from './elevation';
export * from './prepare';
export * from './series';
export * from './stops';
export * from './thin';
export * from './times';

export interface TripAnalysis {
  points: CleanPoint[];
  route: {latitude: number; longitude: number}[];
  times: TripTimes;
  bands: SpeedBand[];
  elevation: ElevationProfile | null;
  stops: Stop[];
  speed: {samples: SpeedSample[]; peak: SpeedSample | null};
}

/** Everything the trip page derives from the GPS points, computed once per trip. */
export const analyseTrip = (raw: TripPoint[]): TripAnalysis => {
  const points = cleanPoints(raw);
  const segs = segments(points);
  return {
    points,
    route: thin(points, MAP_POINTS).map((p) => ({latitude: p.latitude, longitude: p.longitude})),
    times: tripTimes(segs),
    bands: timeAtSpeed(segs),
    elevation: elevationProfile(points),
    stops: detectStops(segs),
    speed: speedSeries(points),
  };
};
```

- [ ] **Step 4: Run** `npx jest src/utils/tripAnalysis && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Checkpoint.**

---

### Task 9: `tripDetailStore`

**Files:**
- Create: `drive-sense-v2/src/stores/tripDetailStore.ts`
- Test: `drive-sense-v2/src/stores/__tests__/tripDetailStore.test.ts`

**Interfaces:**
- Consumes: `tripDetailApi.get`, `tripDetailApi.updateVehicle` (Task 2), `tripUploadApi.remove` (existing), `getApiErrorMessage` (`src/services/apiClient.ts`).
- Produces:

```ts
export type TripLoadStatus = 'loading' | 'ready' | 'error' | 'missing';
export interface TripEntry {status: TripLoadStatus; detail: TripDetail | null; error: string | null}
interface TripDetailState {
  trips: Record<string, TripEntry>;
  /** Error from the last Delete / Change vehicle, shown under the header. */
  actionError: string | null;
  busy: boolean;
  load: (id: string, opts?: {force?: boolean}) => Promise<void>;
  remove: (id: string) => Promise<boolean>;
  changeVehicle: (id: string, vehicleId: string) => Promise<boolean>;
  clearActionError: () => void;
}
export const useTripDetailStore: UseBoundStore<StoreApi<TripDetailState>>;
```

- [ ] **Step 1: Write the failing test**

```ts
import {tripDetailApi, tripUploadApi, type TripDetail} from '../../services/tripService';
import {useTripDetailStore} from '../tripDetailStore';

jest.mock('../../services/tripService', () => ({
  tripDetailApi: {get: jest.fn(), updateVehicle: jest.fn()},
  tripUploadApi: {remove: jest.fn()},
}));

const api = tripDetailApi as jest.Mocked<typeof tripDetailApi>;
const upload = tripUploadApi as jest.Mocked<typeof tripUploadApi>;

const detail = (overrides: Partial<TripDetail> = {}): TripDetail => ({
  id: 't1',
  vehicle_id: 'v1',
  vehicle_name: 'City',
  start_time: '2026-10-11T14:49:00Z',
  end_time: '2026-10-11T15:07:00Z',
  distance_meters: 5400,
  duration_seconds: 1080,
  avg_speed_mps: 6,
  max_speed_mps: 15.5,
  driving_score: 86,
  idle_time_seconds: 195,
  fuel_used_liters: null,
  max_g_force: null,
  max_g_source: null,
  left_turns: 3,
  right_turns: 2,
  start_address: 'Connaught Place',
  end_address: 'Noida',
  location_points: [],
  events: [],
  insights: [],
  ...overrides,
});

const notFound = Object.assign(new Error('Request failed'), {isAxiosError: true, response: {status: 404, data: {detail: 'Trip not found'}}});

describe('tripDetailStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useTripDetailStore.setState({trips: {}, actionError: null, busy: false});
  });

  it('loads a trip once and serves it from cache after', async () => {
    api.get.mockResolvedValue(detail());
    await useTripDetailStore.getState().load('t1');
    await useTripDetailStore.getState().load('t1');
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(useTripDetailStore.getState().trips.t1.status).toBe('ready');
  });

  it('refetches when forced', async () => {
    api.get.mockResolvedValue(detail());
    await useTripDetailStore.getState().load('t1');
    await useTripDetailStore.getState().load('t1', {force: true});
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('marks a 404 as missing and other failures as error', async () => {
    api.get.mockRejectedValueOnce(notFound);
    await useTripDetailStore.getState().load('gone');
    expect(useTripDetailStore.getState().trips.gone.status).toBe('missing');

    api.get.mockRejectedValueOnce(new Error('boom'));
    await useTripDetailStore.getState().load('t2');
    expect(useTripDetailStore.getState().trips.t2.status).toBe('error');
    expect(useTripDetailStore.getState().trips.t2.error).toBeTruthy();
  });

  it('deletes a trip and drops it from the cache', async () => {
    api.get.mockResolvedValue(detail());
    upload.remove.mockResolvedValue(undefined);
    await useTripDetailStore.getState().load('t1');
    expect(await useTripDetailStore.getState().remove('t1')).toBe(true);
    expect(upload.remove).toHaveBeenCalledWith('t1');
    expect(useTripDetailStore.getState().trips.t1).toBeUndefined();
  });

  it('keeps the trip and reports when delete fails', async () => {
    api.get.mockResolvedValue(detail());
    upload.remove.mockRejectedValue(new Error('offline'));
    await useTripDetailStore.getState().load('t1');
    expect(await useTripDetailStore.getState().remove('t1')).toBe(false);
    expect(useTripDetailStore.getState().trips.t1.status).toBe('ready');
    expect(useTripDetailStore.getState().actionError).toBeTruthy();
  });

  it('changes the vehicle then reloads the trip', async () => {
    api.get.mockResolvedValueOnce(detail()).mockResolvedValueOnce(detail({vehicle_id: 'v2', vehicle_name: 'Swift'}));
    api.updateVehicle.mockResolvedValue(undefined);
    await useTripDetailStore.getState().load('t1');
    expect(await useTripDetailStore.getState().changeVehicle('t1', 'v2')).toBe(true);
    expect(api.updateVehicle).toHaveBeenCalledWith('t1', 'v2');
    expect(useTripDetailStore.getState().trips.t1.detail?.vehicle_name).toBe('Swift');
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `src/stores/tripDetailStore.ts`:

```ts
import axios from 'axios';
import {create} from 'zustand';
import {getApiErrorMessage} from '../services/apiClient';
import {tripDetailApi, tripUploadApi, type TripDetail} from '../services/tripService';

export type TripLoadStatus = 'loading' | 'ready' | 'error' | 'missing';

export interface TripEntry {
  status: TripLoadStatus;
  detail: TripDetail | null;
  error: string | null;
}

interface TripDetailState {
  trips: Record<string, TripEntry>;
  actionError: string | null;
  busy: boolean;
  load: (id: string, opts?: {force?: boolean}) => Promise<void>;
  remove: (id: string) => Promise<boolean>;
  changeVehicle: (id: string, vehicleId: string) => Promise<boolean>;
  clearActionError: () => void;
}

const isNotFound = (error: unknown) => axios.isAxiosError(error) ? error.response?.status === 404 : (error as {response?: {status?: number}})?.response?.status === 404;

/** Trips opened from Logbook, cached by id so going back and forth does not refetch. */
export const useTripDetailStore = create<TripDetailState>((set, get) => {
  const put = (id: string, entry: Partial<TripEntry>) =>
    set((s) => ({trips: {...s.trips, [id]: {status: 'loading', detail: null, error: null, ...s.trips[id], ...entry}}}));

  const fetch = async (id: string) => {
    try {
      put(id, {status: 'ready', detail: await tripDetailApi.get(id), error: null});
    } catch (error) {
      put(id, isNotFound(error) ? {status: 'missing', error: null} : {status: 'error', error: getApiErrorMessage(error, 'Could not load this drive.')});
    }
  };

  return {
    trips: {},
    actionError: null,
    busy: false,
    load: async (id, opts) => {
      const current = get().trips[id];
      if (!opts?.force && (current?.status === 'ready' || current?.status === 'loading')) {
        return;
      }
      if (!current?.detail) {
        put(id, {status: 'loading', error: null});
      }
      await fetch(id);
    },
    remove: async (id) => {
      set({busy: true, actionError: null});
      try {
        await tripUploadApi.remove(id);
        set((s) => {
          const {[id]: _gone, ...rest} = s.trips;
          return {trips: rest, busy: false};
        });
        return true;
      } catch (error) {
        set({busy: false, actionError: getApiErrorMessage(error, 'Could not delete this drive.')});
        return false;
      }
    },
    changeVehicle: async (id, vehicleId) => {
      set({busy: true, actionError: null});
      try {
        await tripDetailApi.updateVehicle(id, vehicleId);
        await fetch(id);
        set({busy: false});
        return true;
      } catch (error) {
        set({busy: false, actionError: getApiErrorMessage(error, 'Could not change the vehicle.')});
        return false;
      }
    },
    clearActionError: () => set({actionError: null}),
  };
});
```

Check `getApiErrorMessage`'s signature in `src/services/apiClient.ts` (it is used as `getApiErrorMessage(error, fallback)` in `logbook.tsx`); match it. If `axios.isAxiosError` returns false for the plain-object 404 in the test, the fallback branch in `isNotFound` handles it — keep both branches. If lint flags the unused `_gone`, replace the destructure with `const rest = {...s.trips}; delete rest[id];`.

- [ ] **Step 4: Run** `npx jest src/stores/__tests__/tripDetailStore.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 5: Checkpoint.**

---

### Task 10: Shared pieces — `Split`, `SectionTitle`, `VehiclePickerSheet.onPick`

**Files:**
- Create: `drive-sense-v2/src/components/summary/Split.tsx`
- Create: `drive-sense-v2/src/components/trip/SectionTitle.tsx`
- Modify: `drive-sense-v2/src/app/trip-summary.tsx:31-44` (remove local `Split`, import it)
- Modify: `drive-sense-v2/src/components/drive/VehiclePickerSheet.tsx`

**Interfaces:**
- Produces:

```ts
export function Split({children}: {children: React.ReactNode[]}): JSX.Element; // summary/Split.tsx
export function SectionTitle({icon, color, title, right}: {icon: IconName; color: string; title: string; right?: ReactNode}): JSX.Element;
export function VehiclePickerSheet(props: {visible: boolean; onClose: () => void; selectedId?: string | null; onPick?: (vehicleId: string) => void}): JSX.Element;
```

- [ ] **Step 1: Move `Split`.** Create `src/components/summary/Split.tsx` with the exact `Split` function from `trip-summary.tsx` lines 31–44, plus its imports (`View` from react-native, `useAppTheme`), exported. In `trip-summary.tsx` delete the local function and add `import {Split} from '../components/summary/Split';`.

- [ ] **Step 2: `SectionTitle`** — `src/components/trip/SectionTitle.tsx`:

```tsx
import {Ionicons} from '@expo/vector-icons';
import type {ReactNode} from 'react';
import {View} from 'react-native';
import {AppText} from '../AppText';

type IconName = keyof typeof Ionicons.glyphMap;

/** Section heading on the trip page: tinted icon, title, optional right-hand slot. */
export function SectionTitle({icon, color, title, right}: {icon: IconName; color: string; title: string; right?: ReactNode}) {
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, marginBottom: 8, marginHorizontal: 4}}>
      <Ionicons name={icon} size={18} color={color} />
      <AppText size={17} weight="black" style={{flex: 1}}>
        {title}
      </AppText>
      {right}
    </View>
  );
}
```

- [ ] **Step 3: `VehiclePickerSheet` pick mode.** Change the signature to `{visible, onClose, selectedId, onPick}: {visible: boolean; onClose: () => void; selectedId?: string | null; onPick?: (vehicleId: string) => void}`. Compute `const current = onPick ? selectedId ?? null : activeVehicleId;` and use `current` for `on`. In `onPress`: `if (onPick) { onPick(vehicle.id); } else { void setActive(vehicle.id); } onClose();`. Drive page behaviour is unchanged when `onPick` is omitted.

- [ ] **Step 4: Run** `npx tsc --noEmit && npx jest && npx expo lint` → green. On the simulator, open the after-drive summary path is not required; `trip-summary.tsx` compiles and renders identically (same component).

- [ ] **Step 5: Checkpoint.**

---

### Task 11: Route map — `TripRouteMap` and `RouteFullscreen`

**Files:**
- Create: `drive-sense-v2/src/components/trip/TripRouteMap.tsx` (type anchor)
- Create: `drive-sense-v2/src/components/trip/TripRouteMap.native.tsx`
- Create: `drive-sense-v2/src/components/trip/TripRouteMap.web.tsx`
- Create: `drive-sense-v2/src/components/trip/SpeedLegend.tsx`
- Create: `drive-sense-v2/src/components/trip/RouteFullscreen.tsx`

**Interfaces:**
- Consumes: `speedSegments`, `ColoredLine`, `CleanPoint` (Task 8); `speedScaleStops` (Task 3); `routeRegion`; `EventMarker`; `EventKind`; `DARK_MAP_STYLE` (`src/theme/mapStyle`).
- Produces:

```ts
type LatLng = {latitude: number; longitude: number};
export interface TripRouteMapProps {
  points: CleanPoint[];
  events: (LatLng & {id: string; kind: EventKind})[];
  mode?: 'speed' | 'plain';      // default 'speed'
  interactive?: boolean;          // default false
  focus?: LatLng | null;          // centre here at stop zoom when set
  onExpand?: () => void;          // shows the expand button when set
}
export function TripRouteMap(props: TripRouteMapProps): JSX.Element;
export function SpeedLegend(): JSX.Element;
export function RouteFullscreen(props: {visible: boolean; onClose: () => void; points: CleanPoint[]; events: TripRouteMapProps['events']; focus?: LatLng | null}): JSX.Element;
```

- [ ] **Step 1: `SpeedLegend.tsx`**

```tsx
import {LinearGradient} from 'expo-linear-gradient';
import {View} from 'react-native';
import {useAppTheme} from '../../theme/ThemeProvider';
import {speedScaleStops} from '../../utils/speedColor';
import {AppText} from '../AppText';

/** "0 ▬▬▬ 100+ km/h" chip over the map: the route colour scale. */
export function SpeedLegend() {
  const theme = useAppTheme();
  const stops = speedScaleStops(theme.colors);
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: theme.colors.glassFill}}>
      <AppText size={11} weight="extrabold">0</AppText>
      <LinearGradient colors={stops.map((s) => s.color) as [string, string, ...string[]]} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={{width: 64, height: 6, borderRadius: 3}} />
      <AppText size={11} weight="extrabold">100+ km/h</AppText>
    </View>
  );
}
```

- [ ] **Step 2: `TripRouteMap.native.tsx`**

```tsx
import {Ionicons} from '@expo/vector-icons';
import {useMemo} from 'react';
import {Platform, Pressable, StyleSheet, View} from 'react-native';
import MapView, {Marker, Polyline} from 'react-native-maps';
import {DARK_MAP_STYLE} from '../../theme/mapStyle';
import {useAppTheme} from '../../theme/ThemeProvider';
import {routeRegion} from '../../utils/routeRegion';
import {speedSegments, thin, MAP_POINTS} from '../../utils/tripAnalysis';
import {AppText} from '../AppText';
import {EventMarker} from '../summary/EventMarker';
import {SpeedLegend} from './SpeedLegend';
import type {TripRouteMapProps} from './TripRouteMap.types';

/** Zoom used when a stop is focused (~350 m across). */
const FOCUS_DELTA = 0.0035;

export function TripRouteMap({points, events, mode = 'speed', interactive = false, focus = null, onExpand}: TripRouteMapProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const route = useMemo(() => thin(points, MAP_POINTS).map((p) => ({latitude: p.latitude, longitude: p.longitude})), [points]);
  const lines = useMemo(() => (mode === 'speed' ? speedSegments(points, c) : []), [points, mode, c]);
  const region = focus ? {...focus, latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA} : routeRegion(route);

  if (!region) {
    return (
      <View style={[StyleSheet.absoluteFill, {alignItems: 'center', justifyContent: 'center', backgroundColor: c.control}]}>
        <AppText size={14} weight="bold" tone="secondary">
          No route recorded
        </AppText>
      </View>
    );
  }

  const start = route[0];
  const end = route[route.length - 1];
  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        key={focus ? `${focus.latitude},${focus.longitude}` : 'route'}
        style={StyleSheet.absoluteFill}
        userInterfaceStyle={theme.scheme}
        customMapStyle={Platform.OS === 'android' && theme.scheme === 'dark' ? DARK_MAP_STYLE : undefined}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        initialRegion={region}>
        {route.length > 1 ? (
          <Polyline coordinates={route} strokeColor={mode === 'speed' ? c.glassFill : c.accent} strokeWidth={mode === 'speed' ? 9 : 5} lineCap="round" lineJoin="round" />
        ) : null}
        {lines.map((line) => (
          <Polyline key={line.key} coordinates={line.coords} strokeColor={line.color} strokeWidth={5} lineCap="round" lineJoin="round" zIndex={2} />
        ))}
        {events.map((event) => (
          <Marker key={event.id} coordinate={event} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false} zIndex={3}>
            <EventMarker kind={event.kind} />
          </Marker>
        ))}
        {start ? (
          <Marker coordinate={start} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false} zIndex={4}>
            <Flag color={c.green} />
          </Marker>
        ) : null}
        {end && route.length > 1 ? (
          <Marker coordinate={end} anchor={{x: 0.5, y: 0.5}} tracksViewChanges={false} zIndex={4}>
            <Flag color={c.accent} icon="flag" />
          </Marker>
        ) : null}
      </MapView>
      {mode === 'speed' ? (
        <View pointerEvents="none" style={{position: 'absolute', left: 12, bottom: 12}}>
          <SpeedLegend />
        </View>
      ) : null}
      {onExpand ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open full-screen map"
          onPress={onExpand}
          hitSlop={8}
          style={{position: 'absolute', right: 12, top: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center'}}>
          <Ionicons name="expand" size={18} color={c.textPrimary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Flag({color, icon = 'flag-outline'}: {color: string; icon?: keyof typeof Ionicons.glyphMap}) {
  const theme = useAppTheme();
  return (
    <View style={{width: 30, height: 30, borderRadius: 15, backgroundColor: color, borderWidth: 3, borderColor: theme.colors.onAccent, alignItems: 'center', justifyContent: 'center'}}>
      <Ionicons name={icon} size={14} color={theme.colors.onAccent} />
    </View>
  );
}
```

Create `src/components/trip/TripRouteMap.types.ts` holding `TripRouteMapProps` exactly as in **Interfaces** (import `CleanPoint` from `../../utils/tripAnalysis`, `EventKind` from `../../utils/tripEvents`).

- [ ] **Step 3: `TripRouteMap.web.tsx`** — same props; draws the route with `react-native-svg` like `components/summary/RouteMap.web.tsx` but one `<Line>` per segment coloured with `speedColor(seg.kmh, c)` (use `segments(thin(points, MAP_POINTS))`), plus the legend and expand button. Copy the projection (`toXY`) from `summary/RouteMap.web.tsx`. When `points.length < 2`, render the backdrop with "No route recorded".

- [ ] **Step 4: `TripRouteMap.tsx`** (type anchor, same pattern as `summary/RouteMap.tsx`):

```ts
// Type anchor for the platform split; Metro resolves `.native.tsx` / `.web.tsx` at build time.
export * from './TripRouteMap.native';
```

- [ ] **Step 5: `RouteFullscreen.tsx`**

```tsx
import {Ionicons} from '@expo/vector-icons';
import {useState} from 'react';
import {Modal, Pressable, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAppTheme} from '../../theme/ThemeProvider';
import {AppText} from '../AppText';
import {TripRouteMap} from './TripRouteMap';
import type {TripRouteMapProps} from './TripRouteMap.types';

/** Full-screen route: pan and zoom, and a Speed / Plain switch for a clean view. */
export function RouteFullscreen({visible, onClose, points, events, focus = null}: {visible: boolean; onClose: () => void; points: TripRouteMapProps['points']; events: TripRouteMapProps['events']; focus?: TripRouteMapProps['focus']}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'speed' | 'plain'>('speed');
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{flex: 1, backgroundColor: c.canvas}}>
        <TripRouteMap points={points} events={events} mode={mode} interactive focus={focus} />
        <View style={{position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between'}}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close map" onPress={onClose} hitSlop={8} style={{width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center'}}>
            <Ionicons name="close" size={22} color={c.accent} />
          </Pressable>
          <View style={{flexDirection: 'row', backgroundColor: c.card, borderRadius: 22, padding: 4}}>
            {(['speed', 'plain'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityState={{selected: mode === m}}
                onPress={() => setMode(m)}
                style={{paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: mode === m ? c.accent : 'transparent'}}>
                <AppText size={13} weight="extrabold" color={mode === m ? c.onAccent : c.textPrimary}>
                  {m === 'speed' ? 'Speed' : 'Plain'}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

(`'transparent'` is a keyword, not a colour literal the token test matches.)

- [ ] **Step 6: Run** `npx tsc --noEmit && npx jest && npx expo lint` → green (token contract included).

- [ ] **Step 7: Checkpoint.** Visual check happens in Task 13.

---

### Task 12: Section cards

**Files (all in `drive-sense-v2/src/components/trip/`):**
- Create: `PlaceCard.tsx`, `SpeedChart.tsx`, `TimeAtSpeedCard.tsx`, `ElevationCard.tsx`, `StopsCard.tsx`, `InsightsList.tsx`, `TripDetailSkeleton.tsx`, `chartPath.ts`
- Test: `drive-sense-v2/src/components/trip/__tests__/chartPath.test.ts`

**Interfaces:**
- Consumes: `SpeedSample`, `SpeedBand`, `ElevationProfile`, `Stop`, `DayPeriod` (Tasks 5–8); `speedColor`, `speedScaleStops` (Task 3); `TripInsight` (Task 2); `Card`, `AppText`; `formatDuration` (`src/utils/format.ts`).
- Produces:

```ts
// chartPath.ts — pure
export const linePath: (values: {x: number; y: number}[], width: number, height: number, pad?: number) => {line: string; area: string; toXY: (p: {x: number; y: number}) => {x: number; y: number}};
// components
export function PlaceCard(p: {startAddress: string | null; endAddress: string | null; startTime: string; endTime: string | null; period: DayPeriod}): JSX.Element;
export function SpeedChart(p: {samples: SpeedSample[]; peak: SpeedSample | null}): JSX.Element | null;
export function TimeAtSpeedCard(p: {bands: SpeedBand[]}): JSX.Element | null;
export function ElevationCard(p: {profile: ElevationProfile}): JSX.Element;
export function StopsCard(p: {stops: Stop[]; onSelect: (stop: Stop) => void}): JSX.Element | null;
export function InsightsList(p: {insights: TripInsight[]}): JSX.Element | null;
export function TripDetailSkeleton(): JSX.Element;
```

- [ ] **Step 1: Write the failing test for `chartPath`**

```ts
import {linePath} from '../chartPath';

describe('linePath', () => {
  it('maps the data range onto the box and closes the area to the baseline', () => {
    const {line, area, toXY} = linePath([{x: 0, y: 0}, {x: 10, y: 10}], 100, 50, 0);
    expect(toXY({x: 0, y: 0})).toEqual({x: 0, y: 50});
    expect(toXY({x: 10, y: 10})).toEqual({x: 100, y: 0});
    expect(line).toBe('M0 50L100 0');
    expect(area).toBe('M0 50L100 0L100 50L0 50Z');
  });

  it('handles a flat series without dividing by zero', () => {
    const {line} = linePath([{x: 0, y: 5}, {x: 1, y: 5}], 100, 50, 0);
    expect(line).not.toContain('NaN');
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement `chartPath.ts`:**

```ts
/** SVG path for a line chart and its filled area, data scaled into a width × height box. */
export const linePath = (values: {x: number; y: number}[], width: number, height: number, pad = 4) => {
  const xs = values.map((v) => v.x);
  const ys = values.map((v) => v.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(0, ...ys), Math.max(...ys)];
  const sx = x1 > x0 ? (width - pad * 2) / (x1 - x0) : 0;
  const sy = y1 > y0 ? (height - pad * 2) / (y1 - y0) : 0;
  const round = (n: number) => Math.round(n * 10) / 10;
  const toXY = (p: {x: number; y: number}) => ({x: round(pad + (p.x - x0) * sx), y: round(height - pad - (p.y - y0) * sy)});
  const pts = values.map(toXY);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('');
  const first = pts[0];
  const last = pts[pts.length - 1];
  const area = pts.length > 0 ? `${line}L${last.x} ${height - pad}L${first.x} ${height - pad}Z` : '';
  return {line, area, toXY};
};
```

Note: in the test `pad = 0` and `y0 = min(0, …) = 0`, so the expected strings hold. **Step 4: Run** → PASS.

- [ ] **Step 5: `SpeedChart.tsx`** — card, `SectionTitle` is rendered by the page (not here). Height 120. Width from `onLayout`. Use `linePath(samples.map(s => ({x: s.t, y: s.kmh})), w, 120)`. Draw:
  - `<Defs><LinearGradient id="speedStroke" x1="0" y1="1" x2="0" y2="0">` with one `<Stop>` per `speedScaleStops(theme.colors)` at `offset = min(1, kmh / maxKmh)` where `maxKmh = max(peak.kmh, 1)`; stops above `maxKmh` are skipped. Use `gradientUnits="userSpaceOnUse"` with `y1={120}` `y2={0}` so the colour matches speed height (same reason as `BumpGlass`'s rim gradient).
  - Area path filled with `theme.colors.accent` at `fillOpacity={0.12}`; line path stroked with `url(#speedStroke)` width 3.
  - Peak: `Circle` at `toXY(peak)`, r 5, fill `speedColor(peak.kmh, c)`, stroke `c.card` width 2.
  - Footer row: "Peak **{round(peak.kmh)} km/h** at {HH:MM}" (`new Date(peak.t).toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'})`).
  - Return `null` when `samples.length < 2`.

- [ ] **Step 6: `TimeAtSpeedCard.tsx`** — card; one row per band with `seconds > 0`: label (`0–20`, fixed width 56), bar track (`c.control`, height 10, radius 5) with fill width `share * 100%` coloured `speedColor(midpoint, c)` where midpoint is `[10, 30, 50, 70, 90, 110][index]`, then right text `"{formatDuration(seconds)} · {round(share*100)}%"`. Return `null` when every band is 0.

- [ ] **Step 7: `ElevationCard.tsx`** — card; chart height 90 with `linePath(series.map(s => ({x: s.t, y: s.m - minM})), w, 90)` filled `c.green` at 0.18 and stroked `c.green` width 2.5; below, a row of four values: `↑ {gainM} m` (icon `trending-up`, `c.green`), `↓ {lossM} m` (`trending-down`, `c.red`), `Highest {maxM} m`, `Lowest {minM} m` (round to integers).

- [ ] **Step 8: `StopsCard.tsx`** — card; `const [all, setAll] = useState(false)`; show `all ? stops : stops.slice(0, 3)`. Each row is a `Pressable` (`onPress={() => onSelect(stop)}`, accessibilityLabel `"Stop at {time}, {duration}"`): numbered disc (`c.control`, 26 px), time `HH:MM`, flex spacer, `formatDuration(durationS)` in black weight. If `stops.length > 3`: footer button "Show all {n}" / "Show less". Footer text: `"{n} stops · {formatDuration(total)} total"`. Return `null` for no stops.

- [ ] **Step 9: `InsightsList.tsx`** — renders inside the score card area: for each insight (max 3) a row with icon by tone (`warning` → `alert-circle` `c.amber`; `success` → `checkmark-circle` `c.green`; anything else → `information-circle` `c.blue`), title (extrabold 14) and message (semibold 13 secondary). Return `null` when empty.

- [ ] **Step 10: `PlaceCard.tsx`** — card with two rows: dot (`c.green` start / `c.accent` end, 10 px) + address (`?? 'Unknown place'`) + time `HH:MM` right-aligned; under the rows a chip: `period === 'night'` → icon `moon`, label `Night`, tint `c.purple`; else `sunny`, `Day`, `c.amber` (chip background `c.control`).

- [ ] **Step 11: `TripDetailSkeleton.tsx`** — reuse the pulse from `src/components/WeatherSkeleton.tsx` (read it and copy its `Animated.loop` opacity pattern): a 260-high block (`radius.card`), a 70-high block, then two rows of two 66-high tiles, all `c.control`.

- [ ] **Step 12: Run** `npx tsc --noEmit && npx jest && npx expo lint` → green.

- [ ] **Step 13: Checkpoint.**

---

### Task 13: The page, routing and Logbook

**Files:**
- Create: `drive-sense-v2/src/app/trip/[id].tsx`
- Modify: `drive-sense-v2/src/app/_layout.tsx` (register screen)
- Modify: `drive-sense-v2/src/app/(tabs)/logbook.tsx` (press to open)

**Interfaces:**
- Consumes: everything above; `BentoTile`; `ScoreEventsCard`; `Split`; `VehiclePickerSheet` (`onPick`); `useVehicleStore` (`load`, `vehicles`); `mappableEvents`; `formatKm`, `formatKmh`, `formatDuration`, `formatG`, `formatInt` (`src/utils/format.ts`); `formatDriveTime` (`src/utils/summaryFormat.ts`).

- [ ] **Step 1: Register the route.** In `_layout.tsx`, inside the signed-in `Stack.Protected`, after `all-stats`:

```tsx
<Stack.Screen name="trip/[id]" />
```

- [ ] **Step 2: Logbook opens it.** In `logbook.tsx`: import `Pressable` and `router` from `expo-router`; wrap each `Card` in

```tsx
<Pressable key={trip.id} accessibilityRole="button" accessibilityLabel={`Open drive on ${…same date string…}`} onPress={() => router.push(`/trip/${trip.id}`)} style={({pressed}) => ({opacity: pressed ? 0.8 : 1})}>
  <Card …>…</Card>
</Pressable>
```

(move `key` from `Card` to `Pressable`). Add a `chevron-forward` icon (`Ionicons`, 18, `theme.colors.textTertiary`) at the right of the address row.

- [ ] **Step 3: Write the page** `src/app/trip/[id].tsx`:

```tsx
import {Ionicons} from '@expo/vector-icons';
import {router, useLocalSearchParams} from 'expo-router';
import {useEffect, useMemo, useState} from 'react';
import {ActionSheetIOS, Alert, Platform, Pressable, ScrollView, Share, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppText} from '../../components/AppText';
import {BentoTile} from '../../components/BentoTile';
import {Card} from '../../components/Card';
import {VehiclePickerSheet} from '../../components/drive/VehiclePickerSheet';
import {ScoreEventsCard} from '../../components/summary/ScoreEventsCard';
import {Split} from '../../components/summary/Split';
import {ElevationCard} from '../../components/trip/ElevationCard';
import {InsightsList} from '../../components/trip/InsightsList';
import {PlaceCard} from '../../components/trip/PlaceCard';
import {RouteFullscreen} from '../../components/trip/RouteFullscreen';
import {SectionTitle} from '../../components/trip/SectionTitle';
import {SpeedChart} from '../../components/trip/SpeedChart';
import {StopsCard} from '../../components/trip/StopsCard';
import {TimeAtSpeedCard} from '../../components/trip/TimeAtSpeedCard';
import {TripDetailSkeleton} from '../../components/trip/TripDetailSkeleton';
import {TripRouteMap} from '../../components/trip/TripRouteMap';
import {useTripDetailStore} from '../../stores/tripDetailStore';
import {useVehicleStore} from '../../stores/vehicleStore';
import {useAppTheme} from '../../theme/ThemeProvider';
import {DASH, formatDuration, formatG, formatInt, formatKm, formatKmh} from '../../utils/format';
import {formatDriveTime} from '../../utils/summaryFormat';
import {analyseTrip, dayPeriod, type Stop} from '../../utils/tripAnalysis';
import {mappableEvents} from '../../utils/tripEvents';

type LatLng = {latitude: number; longitude: number};

export default function TripDetailScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const {id} = useLocalSearchParams<{id: string}>();
  const entry = useTripDetailStore((s) => s.trips[id]);
  const {load, remove, changeVehicle, actionError, busy} = useTripDetailStore();
  const loadVehicles = useVehicleStore((s) => s.load);
  const [fullscreen, setFullscreen] = useState<{open: boolean; focus: LatLng | null}>({open: false, focus: null});
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    void load(id);
  }, [id, load]);

  const detail = entry?.detail ?? null;
  const analysis = useMemo(() => (detail ? analyseTrip(detail.location_points) : null), [detail]);
  const events = useMemo(() => (detail ? mappableEvents(detail.events) : []), [detail]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/logbook'));

  const onDelete = () =>
    Alert.alert('Delete this drive?', "This can't be undone.", [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => (await remove(id)) && back()},
    ]);
  const onShare = () => {
    if (!detail) return;
    const score = detail.driving_score != null ? `, score ${Math.round(detail.driving_score)}` : '';
    void Share.share({message: `Drove ${formatKm(detail.distance_meters)} km in ${formatDriveTime(detail.duration_seconds)}, top speed ${formatKmh(detail.max_speed_mps)} km/h${score}. Recorded with DriveSense.`});
  };
  const onChangeVehicle = () => {
    void loadVehicles();
    setPicking(true);
  };
  const onMore = () => {
    const options = ['Share', 'Change vehicle', 'Delete', 'Cancel'];
    const run = (i: number) => [onShare, onChangeVehicle, onDelete][i]?.();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({options, destructiveButtonIndex: 2, cancelButtonIndex: 3}, run);
    } else {
      Alert.alert('Drive', undefined, [
        {text: 'Share', onPress: onShare},
        {text: 'Change vehicle', onPress: onChangeVehicle},
        {text: 'Delete', style: 'destructive', onPress: onDelete},
        {text: 'Cancel', style: 'cancel'},
      ]);
    }
  };

  const start = detail ? new Date(detail.start_time) : null;
  const title = detail?.start_address?.split(',')[0] ?? 'Drive';
  const subtitle = start ? start.toLocaleString('en-IN', {weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'}) : '';
  const topSpeedMps = detail?.max_speed_mps ?? (analysis?.speed.peak ? analysis.speed.peak.kmh / 3.6 : null);
  const turns = detail && detail.left_turns != null && detail.right_turns != null ? `${detail.left_turns} L · ${detail.right_turns} R` : null;
  const maxG = detail?.max_g_force != null ? `${detail.max_g_source === 'sensor' ? '' : '≈'}${formatG(detail.max_g_force)}` : null;

  const tiles: {label: string; value: string; unit?: string; icon: keyof typeof Ionicons.glyphMap; color: string}[] = detail && analysis
    ? [
        {label: 'Distance', value: formatKm(detail.distance_meters), unit: 'km', icon: 'map', color: c.blue},
        {label: 'Avg speed', value: analysis.times.movingS > 0 ? formatInt((detail.distance_meters / analysis.times.movingS) * 3.6) : formatKmh(detail.avg_speed_mps), unit: 'km/h', icon: 'speedometer', color: c.cyan},
        {label: 'Stops', value: String(analysis.stops.length), icon: 'stop-circle', color: c.red},
        {label: 'Idle time', value: formatDuration(analysis.times.idleS || detail.idle_time_seconds), icon: 'pause-circle', color: c.textSecondary},
        ...(analysis.elevation ? [{label: 'Climb', value: formatInt(analysis.elevation.gainM), unit: 'm', icon: 'trending-up' as const, color: c.green}] : []),
        ...(turns ? [{label: 'Turns', value: turns, icon: 'git-branch' as const, color: c.blue}] : []),
        ...(maxG ? [{label: 'Max G', value: maxG, unit: 'G', icon: 'magnet' as const, color: c.purple}] : []),
        ...(analysis.times.movingS > 0 ? [{label: 'Moving time', value: formatDuration(analysis.times.movingS), icon: 'play-circle' as const, color: c.green}] : []),
      ]
    : [];

  const header = (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14}}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={8} style={{width: 44, height: 44, borderRadius: 22, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center'}}>
        <Ionicons name="chevron-back" size={22} color={c.accent} />
      </Pressable>
      <View style={{flex: 1, alignItems: 'center'}}>
        <AppText size={18} weight="black" numberOfLines={1}>{title}</AppText>
        <AppText size={12} weight="semibold" tone="secondary">{subtitle}</AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="More actions" disabled={!detail || busy} onPress={onMore} hitSlop={8} style={{width: 44, height: 44, borderRadius: 22, backgroundColor: c.control, alignItems: 'center', justifyContent: 'center', opacity: detail && !busy ? 1 : 0.5}}>
        <Ionicons name="ellipsis-horizontal" size={22} color={c.accent} />
      </Pressable>
    </View>
  );

  const body = (() => {
    if (!entry || entry.status === 'loading') return <TripDetailSkeleton />;
    if (entry.status === 'missing') return <Message text="This drive no longer exists." action="Back" onPress={back} />;
    if (entry.status === 'error' || !detail || !analysis) return <Message text={entry.error ?? 'Could not load this drive.'} action="Retry" onPress={() => void load(id, {force: true})} />;
    return (
      <View style={{gap: theme.space.cardGap}}>
        <Card style={{overflow: 'hidden'}}>
          <View style={{height: 260}}>
            <TripRouteMap points={analysis.points} events={events} onExpand={() => setFullscreen({open: true, focus: null})} />
          </View>
        </Card>
        <PlaceCard startAddress={detail.start_address} endAddress={detail.end_address} startTime={detail.start_time} endTime={detail.end_time} period={dayPeriod(detail.start_time)} />
        <View style={{backgroundColor: c.accentTint, borderRadius: theme.radius.hero, paddingVertical: 22}}>
          <Split>
            <>
              <AppText size={46} weight="black" style={{lineHeight: 52}}>{formatKmh(topSpeedMps)}</AppText>
              <AppText size={15} weight="extrabold" tone="accent">km/h Top Speed</AppText>
            </>
            <>
              <AppText size={46} weight="black" style={{lineHeight: 52}}>{formatDriveTime(detail.duration_seconds)}</AppText>
              <AppText size={15} weight="extrabold" tone="accent">Drive Time</AppText>
            </>
          </Split>
        </View>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.cardGap}}>
          {tiles.map((t) => (
            <BentoTile key={t.label} label={t.label} value={t.value} unit={t.unit} icon={t.icon} iconColor={t.color} style={{flexBasis: '47%', flexGrow: 1}} />
          ))}
        </View>

        <SectionTitle icon="ribbon" color={c.green} title="Score & events" />
        <ScoreEventsCard detail={detail} pending={false} phoneEventCount={detail.events.length} />
        {detail.insights.length > 0 ? (
          <Card style={{padding: 16, gap: 12}}>
            <InsightsList insights={detail.insights} />
          </Card>
        ) : null}

        {analysis.speed.samples.length > 1 ? (
          <>
            <SectionTitle icon="pulse" color={c.accent} title="Speed" />
            <SpeedChart samples={analysis.speed.samples} peak={analysis.speed.peak} />
            <TimeAtSpeedCard bands={analysis.bands} />
          </>
        ) : null}

        {analysis.elevation ? (
          <>
            <SectionTitle icon="triangle" color={c.cyan} title="Elevation" />
            <ElevationCard profile={analysis.elevation} />
          </>
        ) : null}

        {analysis.stops.length > 0 ? (
          <>
            <SectionTitle icon="pause-circle" color={c.textSecondary} title="Stops" />
            <StopsCard stops={analysis.stops} onSelect={(stop: Stop) => setFullscreen({open: true, focus: {latitude: stop.latitude, longitude: stop.longitude}})} />
          </>
        ) : null}
      </View>
    );
  })();

  return (
    <View style={{flex: 1, backgroundColor: c.canvas}}>
      <ScrollView contentContainerStyle={{paddingTop: insets.top + 8, paddingHorizontal: theme.space.screen, paddingBottom: insets.bottom + 40}}>
        {header}
        {actionError ? (
          <View style={{backgroundColor: c.accentTint, borderRadius: 16, padding: 12, marginBottom: 10}}>
            <AppText size={13} weight="bold" tone="accent">{actionError}</AppText>
          </View>
        ) : null}
        {body}
      </ScrollView>
      {analysis ? (
        <RouteFullscreen visible={fullscreen.open} onClose={() => setFullscreen({open: false, focus: null})} points={analysis.points} events={events} focus={fullscreen.focus} />
      ) : null}
      <VehiclePickerSheet visible={picking} onClose={() => setPicking(false)} selectedId={detail?.vehicle_id ?? null} onPick={(vehicleId) => void changeVehicle(id, vehicleId)} />
    </View>
  );
}

function Message({text, action, onPress}: {text: string; action: string; onPress: () => void}) {
  const theme = useAppTheme();
  return (
    <Card style={{padding: 20, gap: 14, alignItems: 'center'}}>
      <AppText size={15} weight="bold" tone="secondary" style={{textAlign: 'center'}}>{text}</AppText>
      <Pressable accessibilityRole="button" onPress={onPress} style={{backgroundColor: theme.colors.accent, borderRadius: 99, paddingHorizontal: 22, paddingVertical: 10}}>
        <AppText size={15} weight="black" tone="onAccent">{action}</AppText>
      </Pressable>
    </Card>
  );
}
```

Unused imports (`DASH`) must be removed if lint complains. Check that `formatG` exists in `src/utils/format.ts` (it does: `formatG`), and that `AppText` supports `tone="accent"` and `tone="onAccent"` (used in `trip-summary.tsx`).

- [ ] **Step 4: Run** `npx tsc --noEmit && npx jest && npx expo lint` → green.

- [ ] **Step 5: Simulator verification** (local API, Expo on port 8082, simulator `D60A8A8B-272A-4F0F-AB7C-145024A50154`):
  1. Restart the backend container so the PATCH route is live: `docker compose restart backend` from the repo root.
  2. Record a short drive with `xcrun simctl location booted start --speed=15 <lat,lon> <lat,lon> …` (as earlier sessions did), end it and Save.
  3. Logbook → tap the new trip. Check: map shows a coloured route with flags and legend; place card; hero; tiles; score card; speed chart with peak; time-at-speed bars; elevation (if altitudes); stops (if any).
  4. Expand → full-screen map; switch Speed / Plain; close.
  5. Tap a stop → full-screen map centred on it.
  6. ⋯ → Change vehicle → pick another → header subtitle/tiles reload, no error.
  7. ⋯ → Delete → confirm → back on Logbook, trip gone.
  8. Open a seeded demo trip (sparse points): page renders, sections without data are hidden, no crash.
  9. Toggle Appearance to Dark in Settings and re-open a trip: colours readable.
  Take one screenshot of the page and one of the full-screen map as proof.

- [ ] **Step 6: Checkpoint.** Report results to the user; do not commit.

---

## Self-review notes

- Spec coverage: layout sections 1–10 → Tasks 11–13; colour scale → Task 3; helpers → Tasks 4–8; store → Task 9; ⋯ menu → Task 13; PATCH → Task 1; states/errors → Tasks 9, 12 (skeleton), 13 (Message); testing → each task + Task 13 Step 5.
- The spec lists `speedSegments(points, theme)`; the plan passes `theme.colors` (it satisfies `SpeedScaleColors`). Same intent.
- `Logbook refreshes on return` is already true (`useFocusEffect` reloads the list).
