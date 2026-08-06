# Surface Unused Telemetry Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface six pieces of telemetry/insight data that are already computed but never rendered (g-force smoothness, recurring cross-trip insights, vehicle trend granularity + distance/score overlay, fuel cost/usage trend), and fix the Best/Worst vehicle comparison threshold bug.

**Architecture:** Backend adds one new read endpoint (`GET /dashboard/insights`) and one new query parameter (`granularity` on `GET /vehicles/{id}/stats`), both built on existing tables/services — no new models or migrations. Mobile adds one new small presentational component (`SmoothnessGauge`) and extends two existing screens (`DashboardScreen`, `VehicleAnalyticsScreen`) and one shared layout (`LiveTrackingLayout`) to render data that server responses and hooks already return today.

**Tech Stack:** FastAPI + SQLAlchemy async (backend), React Native / Expo + Zustand (mobile), pytest (backend unit tests), Jest + @testing-library/react-native (mobile tests).

## Global Constraints

- Backend unit tests live in `backend/tests/unit/`, contain **no DB access** (existing convention — every current unit test is a pure function test). Any new DB-querying function is exercised only through its pure helper/formatter, not through a live DB unit test.
- Mobile tests are colocated in `__tests__/` directories beside the module under test, using the existing `mockApiClient.ts` helper for service tests and `@testing-library/react-native` for component tests.
- `GET /dashboard` (daily trend, 30-day window) must be **byte-for-byte unaffected** by the granularity work — omitting the new param anywhere preserves current behavior exactly.
- `LiveTrackingLayout.tsx` is shared by both `MapScreen.native.tsx` (real `useLiveTracking.native.ts`) and `MapScreen.web.tsx` (`useMockLiveTracking.ts`) — any new field added to its `LiveTrackingData` type must be populated by **both** hooks, and any new component it renders must not import native-only modules (`expo-location`, `expo-sensors`).
- No new npm/pip dependencies. No chart library exists in this repo (`react-native-svg`/`victory-native`/etc. verified absent) — all "trend chart" work reuses the existing plain-`View`-with-dynamic-height bar pattern already in `VehicleAnalyticsScreen.tsx`.
- The original design's "live stats strip" item (avg/max speed, GPS accuracy on `MapScreen`) is **already implemented** in the current codebase — `LiveTrackingLayout.tsx`'s "Tracking Health" and "TELEMETRY FEED" sections already render `data.stats`/`data.timeline`/`data.currentPoint.accuracy_m`. No task below touches that; it's called out here only so this plan isn't mistaken for missing it.

---

### Task 1: Backend — recurring-insight ranking (pure function)

**Files:**
- Modify: `backend/app/services/trip_insight_service.py`
- Test: `backend/tests/unit/test_trip_insight_service.py`

**Interfaces:**
- Produces: `RecurringEventGroup` dataclass (`event_type: str`, `time_bucket: str`, `count: int`) and `build_recurring_insights(groups: Sequence[RecurringEventGroup], *, limit: int = 3) -> list[TripInsight]`, both importable from `app.services.trip_insight_service`. Reuses the existing `TripInsight` dataclass and `_format_count` helper already in this file.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/unit/test_trip_insight_service.py` (add the import at the top alongside the existing one, and add a new test class at the bottom, before the `if __name__ == "__main__":` block):

```python
from app.services.trip_insight_service import RecurringEventGroup, build_recurring_insights
```

```python
class BuildRecurringInsightsTest(unittest.TestCase):
    def test_below_minimum_total_returns_empty(self):
        groups = [RecurringEventGroup(event_type="harsh_brake", time_bucket="evening", count=2)]

        self.assertEqual([], build_recurring_insights(groups))

    def test_ranks_by_count_descending(self):
        groups = [
            RecurringEventGroup(event_type="harsh_brake", time_bucket="evening", count=5),
            RecurringEventGroup(event_type="overspeed", time_bucket="morning", count=9),
            RecurringEventGroup(event_type="rapid_acceleration", time_bucket="afternoon", count=3),
        ]

        insights = build_recurring_insights(groups)

        self.assertEqual(
            ["recurring_overspeed_morning", "recurring_harsh_brake_evening", "recurring_rapid_acceleration_afternoon"],
            [insight.rule_id for insight in insights],
        )
        self.assertEqual("warning", insights[0].tone)
        self.assertEqual("9 events", insights[0].metric_value)

    def test_caps_at_limit(self):
        groups = [
            RecurringEventGroup(event_type="harsh_brake", time_bucket="evening", count=10),
            RecurringEventGroup(event_type="overspeed", time_bucket="morning", count=9),
            RecurringEventGroup(event_type="rapid_acceleration", time_bucket="afternoon", count=8),
            RecurringEventGroup(event_type="harsh_brake", time_bucket="morning", count=7),
        ]

        insights = build_recurring_insights(groups, limit=3)

        self.assertEqual(3, len(insights))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/unit/test_trip_insight_service.py -v`
Expected: FAIL with `ImportError: cannot import name 'RecurringEventGroup'`

- [ ] **Step 3: Implement `RecurringEventGroup` and `build_recurring_insights`**

In `backend/app/services/trip_insight_service.py`, add after the existing `TripInsight` dataclass definition (after line 23):

```python
@dataclass(frozen=True)
class RecurringEventGroup:
    event_type: str
    time_bucket: str
    count: int


RECURRING_INSIGHT_MIN_TOTAL_EVENTS = 3

_RECURRING_INSIGHT_TONE = {
    OVERSPEED_EVENT: "warning",
    HARSH_BRAKING_EVENT: "warning",
    RAPID_ACCELERATION_EVENT: "info",
}

_RECURRING_INSIGHT_TITLE = {
    OVERSPEED_EVENT: "Frequent overspeeding",
    HARSH_BRAKING_EVENT: "Frequent harsh braking",
    RAPID_ACCELERATION_EVENT: "Frequent rapid acceleration",
}
```

Add after the existing `generate_trip_insights` function (end of file):

```python
def build_recurring_insights(
    groups: Sequence[RecurringEventGroup], *, limit: int = 3
) -> list[TripInsight]:
    total = sum(group.count for group in groups)
    if total < RECURRING_INSIGHT_MIN_TOTAL_EVENTS:
        return []

    ranked = sorted(groups, key=lambda group: group.count, reverse=True)[:limit]
    insights: list[TripInsight] = []
    for group in ranked:
        tone = _RECURRING_INSIGHT_TONE.get(group.event_type, "info")
        title = _RECURRING_INSIGHT_TITLE.get(group.event_type, "Recurring pattern")
        insights.append(
            TripInsight(
                rule_id=f"recurring_{group.event_type}_{group.time_bucket}",
                category="pattern",
                tone=tone,
                title=title,
                message=f"You {group.event_type.replace('_', ' ')} most often in the {group.time_bucket}.",
                metric_label="Occurrences",
                metric_value=_format_count(group.count),
                priority=group.count,
            )
        )
    return insights
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/unit/test_trip_insight_service.py -v`
Expected: PASS (all tests, including the pre-existing `GenerateTripInsightsTest` cases)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/trip_insight_service.py backend/tests/unit/test_trip_insight_service.py
git commit -m "feat: add recurring-insight ranking to trip_insight_service"
```

---

### Task 2: Backend — recurring-insight query + `GET /dashboard/insights` endpoint

**Files:**
- Modify: `backend/app/services/dashboard_service.py`
- Modify: `backend/app/routers/dashboard_router.py`

**Interfaces:**
- Consumes: `RecurringEventGroup`, `build_recurring_insights` from Task 1 (`app.services.trip_insight_service`); `TripInsightRead` from `app.schemas.trip` (existing).
- Produces: `get_recurring_insights_data(db: AsyncSession, *, user_id: uuid.UUID, days: int = RECURRING_INSIGHTS_DAYS) -> list[TripInsight]` in `dashboard_service.py`. New route `GET /dashboard/insights` → `list[TripInsightRead]`.

- [ ] **Step 1: Add the query function to `dashboard_service.py`**

In `backend/app/services/dashboard_service.py`, change the import block (lines 6, 14-25) to add `extract`:

```python
from sqlalchemy import case, extract, func, select
```

and add the new imports alongside the existing `app.schemas.dashboard` import block:

```python
from app.services.trip_insight_service import RecurringEventGroup, TripInsight, build_recurring_insights
```

Add a new constant near the existing constants (after line 31):

```python
RECURRING_INSIGHTS_DAYS = 30
```

Add near the bottom of the file, after `get_recent_events_page` (after line 490):

```python
_HOUR_BUCKET_EXPR = case(
    (extract("hour", Event.occurred_at) < 6, "night"),
    (extract("hour", Event.occurred_at) < 12, "morning"),
    (extract("hour", Event.occurred_at) < 18, "afternoon"),
    else_="evening",
)


async def get_recurring_insights_data(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    days: int = RECURRING_INSIGHTS_DAYS,
) -> list[TripInsight]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(
            Event.event_type,
            _HOUR_BUCKET_EXPR.label("time_bucket"),
            func.count(Event.id).label("count"),
        )
        .select_from(Event)
        .join(Trip, Trip.id == Event.trip_id)
        .where(
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
            Event.occurred_at >= since,
        )
        .group_by(Event.event_type, "time_bucket")
    )
    rows = (await db.execute(stmt)).all()
    groups = [
        RecurringEventGroup(event_type=row.event_type, time_bucket=row.time_bucket, count=_to_int(row.count))
        for row in rows
    ]
    return build_recurring_insights(groups)
```

- [ ] **Step 2: Add the endpoint to `dashboard_router.py`**

In `backend/app/routers/dashboard_router.py`, update the imports:

```python
from app.schemas.dashboard import DashboardResponse, RecentEventPage, VehicleStatsResponse
from app.schemas.trip import TripInsightRead
from app.services.dashboard_service import (
    get_dashboard_data,
    get_recent_events_page,
    get_recurring_insights_data,
    get_vehicle_stats_data,
)
```

Add the new route after `get_dashboard_events` (after line 31):

```python
@router.get("/dashboard/insights", response_model=list[TripInsightRead])
async def get_dashboard_insights(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TripInsightRead]:
    insights = await get_recurring_insights_data(db, user_id=user.id)
    return [
        TripInsightRead(
            rule_id=insight.rule_id,
            category=insight.category,
            tone=insight.tone,
            title=insight.title,
            message=insight.message,
            metric_label=insight.metric_label,
            metric_value=insight.metric_value,
            priority=insight.priority,
        )
        for insight in insights
    ]
```

- [ ] **Step 3: Verify the backend boots and the route is registered**

Run: `cd backend && python -c "from app.main import app; print([r.path for r in app.routes if 'insights' in r.path])"`
Expected: `['/api/v1/dashboard/insights']` (confirms the router wiring and imports are valid — no DB needed for this check)

- [ ] **Step 4: Run the full unit suite to check nothing broke**

Run: `cd backend && python -m pytest tests/unit -v`
Expected: PASS (unchanged tests still pass; this task adds no new unit tests since the new code is a DB-querying function, consistent with the rest of `dashboard_service.py` having no unit tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/dashboard_service.py backend/app/routers/dashboard_router.py
git commit -m "feat: add GET /dashboard/insights recurring-insight endpoint"
```

---

### Task 3: Backend — trend granularity lookback resolver (pure function)

**Files:**
- Modify: `backend/app/services/dashboard_service.py`
- Test: `backend/tests/unit/test_dashboard_trend_helpers.py` (new)

**Interfaces:**
- Produces: `TREND_LOOKBACK_DAYS: dict[str, int]` and `resolve_trend_lookback_days(granularity: str) -> int` in `app.services.dashboard_service`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/test_dashboard_trend_helpers.py`:

```python
from __future__ import annotations

import pytest

from app.services.dashboard_service import resolve_trend_lookback_days


def test_resolve_trend_lookback_days_day():
    assert resolve_trend_lookback_days("day") == 30


def test_resolve_trend_lookback_days_week():
    assert resolve_trend_lookback_days("week") == 84


def test_resolve_trend_lookback_days_month():
    assert resolve_trend_lookback_days("month") == 365


def test_resolve_trend_lookback_days_invalid_raises():
    with pytest.raises(KeyError):
        resolve_trend_lookback_days("year")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_dashboard_trend_helpers.py -v`
Expected: FAIL with `ImportError: cannot import name 'resolve_trend_lookback_days'`

- [ ] **Step 3: Implement the resolver**

In `backend/app/services/dashboard_service.py`, add after the `DASHBOARD_TREND_DAYS = 30` line (line 28):

```python
TREND_LOOKBACK_DAYS = {"day": DASHBOARD_TREND_DAYS, "week": 84, "month": 365}


def resolve_trend_lookback_days(granularity: str) -> int:
    return TREND_LOOKBACK_DAYS[granularity]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/test_dashboard_trend_helpers.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/dashboard_service.py backend/tests/unit/test_dashboard_trend_helpers.py
git commit -m "feat: add trend granularity lookback resolver"
```

---

### Task 4: Backend — thread `granularity` through trip trend + vehicle stats endpoint

**Files:**
- Modify: `backend/app/services/dashboard_service.py`
- Modify: `backend/app/routers/dashboard_router.py`

**Interfaces:**
- Consumes: `resolve_trend_lookback_days` from Task 3.
- Produces: `_get_trip_trend(..., granularity: str = "day", days: int | None = None)` and `get_vehicle_stats_data(..., granularity: str = "day")` with backward-compatible defaults. Router: `GET /vehicles/{vehicle_id}/stats?granularity=day|week|month`.

- [ ] **Step 1: Update `_get_trip_trend`**

In `backend/app/services/dashboard_service.py`, replace the `_get_trip_trend` function (lines 153-192) with:

```python
async def _get_trip_trend(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID | None = None,
    granularity: str = "day",
    days: int | None = None,
) -> list[TrendPoint]:
    resolved_days = days if days is not None else resolve_trend_lookback_days(granularity)
    since = datetime.now(timezone.utc) - timedelta(days=resolved_days)
    stmt = (
        select(
            func.date_trunc(granularity, Trip.start_time).label("bucket_start"),
            func.count(Trip.id).label("trip_count"),
            func.coalesce(func.sum(Trip.distance_meters), 0).label("distance_meters"),
            func.coalesce(func.sum(Trip.fuel_used_liters), 0).label("fuel_used_liters"),
            func.coalesce(func.sum(Trip.cost_amount), 0).label("fuel_cost_amount"),
            func.avg(Trip.driving_score).label("avg_driving_score"),
        )
        .where(
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
            Trip.start_time >= since,
        )
        .group_by("bucket_start")
        .order_by("bucket_start")
    )
    if vehicle_id is not None:
        stmt = stmt.where(Trip.vehicle_id == vehicle_id)

    rows = (await db.execute(stmt)).all()
    return [
        TrendPoint(
            bucket_start=row.bucket_start,
            trip_count=_to_int(row.trip_count),
            distance_meters=_to_float(row.distance_meters),
            fuel_used_liters=_to_float(row.fuel_used_liters),
            fuel_cost_amount=_to_float(row.fuel_cost_amount),
            avg_driving_score=float(row.avg_driving_score) if row.avg_driving_score is not None else None,
        )
        for row in rows
    ]
```

- [ ] **Step 2: Thread `granularity` through `get_vehicle_stats_data`**

Replace the `get_vehicle_stats_data` function (lines 493-513) with:

```python
async def get_vehicle_stats_data(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID,
    granularity: str = "day",
) -> VehicleStatsResponse | None:
    summary = await _get_vehicle_overview(db, user_id=user_id, vehicle_id=vehicle_id)
    if summary is None:
        return None

    trip_trend = await _get_trip_trend(db, user_id=user_id, vehicle_id=vehicle_id, granularity=granularity)
    fuel_trend = await _get_fuel_trend(db, user_id=user_id, vehicle_id=vehicle_id)
    events = await _get_event_breakdown(db, user_id=user_id, vehicle_id=vehicle_id)
    recent_trips = await _get_recent_trips(db, user_id=user_id, vehicle_id=vehicle_id)
    return VehicleStatsResponse(
        summary=summary,
        trip_trend=trip_trend,
        fuel_trend=fuel_trend,
        events=events,
        recent_trips=recent_trips,
    )
```

Note: `get_dashboard_data`'s call to `_get_trip_trend(db, user_id=user_id)` (line 465) needs no change — `granularity` defaults to `"day"` and `days` defaults to `None` (which resolves to `30` via `resolve_trend_lookback_days("day")`), identical to today's hardcoded behavior.

- [ ] **Step 3: Add the query param to the router**

In `backend/app/routers/dashboard_router.py`, update the `from uuid import UUID` line's neighboring imports to add `Literal`:

```python
from typing import Literal
from uuid import UUID
```

Replace the `get_vehicle_stats` route (lines 34-43) with:

```python
@router.get("/vehicles/{vehicle_id}/stats", response_model=VehicleStatsResponse)
async def get_vehicle_stats(
    vehicle_id: UUID,
    granularity: Literal["day", "week", "month"] = Query(default="day"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VehicleStatsResponse:
    stats = await get_vehicle_stats_data(db, user_id=user.id, vehicle_id=vehicle_id, granularity=granularity)
    if stats is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    return stats
```

- [ ] **Step 4: Run the full backend unit suite**

Run: `cd backend && python -m pytest tests/unit -v`
Expected: PASS (no unit tests directly cover `_get_trip_trend`'s SQL — it requires a DB — but this confirms no import/syntax regressions)

Run: `cd backend && python -c "from app.main import app; print('ok')"`
Expected: `ok` (confirms `Literal`/`Query` wiring is valid)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/dashboard_service.py backend/app/routers/dashboard_router.py
git commit -m "feat: add granularity param to vehicle trip trend"
```

---

### Task 5: Mobile — shared driving thresholds + expose live acceleration from both tracking hooks

**Files:**
- Create: `mobile-expo/src/utils/drivingThresholds.ts`
- Modify: `mobile-expo/src/hooks/useLiveTracking.native.ts`
- Modify: `mobile-expo/src/hooks/useMockLiveTracking.ts`

**Interfaces:**
- Produces: `GRAVITY_MPS2`, `RAPID_ACCELERATION_MPS2`, `HARSH_BRAKE_MPS2` (all `number`) exported from `mobile-expo/src/utils/drivingThresholds.ts`. Both `useLiveTracking` (native) and `useMockLiveTracking` (web) return an added `latestAcceleration: number` field (m/s², total magnitude including gravity).

This is a platform-agnostic file (no `expo-location`/`expo-sensors` imports) so it is safe for the `SmoothnessGauge` component (Task 6) to import from directly, regardless of which platform bundle it ends up in.

- [ ] **Step 1: Create the shared thresholds module**

Create `mobile-expo/src/utils/drivingThresholds.ts`:

```ts
export const GRAVITY_MPS2 = 9.81;
export const RAPID_ACCELERATION_MPS2 = 3.0;
export const HARSH_BRAKE_MPS2 = -3.5;
```

- [ ] **Step 2: Use the shared constants in `useLiveTracking.native.ts` and expose `latestAcceleration`**

In `mobile-expo/src/hooks/useLiveTracking.native.ts`, replace lines 36-38:

```ts
const OVERSPEED_MPS = 27.78;
const RAPID_ACCELERATION_MPS2 = 3.0;
const HARSH_BRAKE_MPS2 = -3.5;
```

with:

```ts
import {GRAVITY_MPS2, HARSH_BRAKE_MPS2, RAPID_ACCELERATION_MPS2} from '../utils/drivingThresholds';

const OVERSPEED_MPS = 27.78;
```

(Add the import near the top of the file with the other imports, e.g. right after the `useDashboardStore` import on line 6 — `GRAVITY_MPS2` is not used elsewhere in this file today, which is fine; it's re-exported implicitly via the shared module for the gauge to consume directly.)

In the hook's return object (inside the object built at line 755), add `latestAcceleration` alongside the existing `paceDelta` field (after line 771):

```ts
    paceDelta: lastEvent ? `${lastEvent.event_type.replace('_', ' ')} detected` : `${latestAcceleration.magnitude.toFixed(1)} m/s² motion`,
    latestAcceleration: latestAcceleration.magnitude,
```

- [ ] **Step 3: Expose a matching mock value from `useMockLiveTracking.ts`**

In `mobile-expo/src/hooks/useMockLiveTracking.ts`, add the import at the top:

```ts
import {GRAVITY_MPS2} from '../utils/drivingThresholds';
```

In the return object (after line 271, `paceDelta: frame.harshBrake,`), add:

```ts
    latestAcceleration: GRAVITY_MPS2 + (frame.events > 0 ? 4.2 : 0.4),
```

This keeps the web/mock experience deterministic: frames with recorded mock events show a "harsh" band, frames without show "smooth" — consistent with how `frame.events`/`frame.harshBrake` already drive the rest of the mock UI.

- [ ] **Step 4: Typecheck**

Run: `cd mobile-expo && npm run typecheck`
Expected: PASS (no type errors — both hooks already return object literals inferred structurally; `LiveTrackingLayout`'s `LiveTrackingData` type is updated in Task 7, so no consumer breaks yet since it doesn't yet reference `latestAcceleration`)

- [ ] **Step 5: Commit**

```bash
git add mobile-expo/src/utils/drivingThresholds.ts mobile-expo/src/hooks/useLiveTracking.native.ts mobile-expo/src/hooks/useMockLiveTracking.ts
git commit -m "feat: expose latestAcceleration from live tracking hooks"
```

---

### Task 6: Mobile — `SmoothnessGauge` component

**Files:**
- Create: `mobile-expo/src/components/SmoothnessGauge.tsx`
- Test: `mobile-expo/src/components/__tests__/SmoothnessGauge.test.tsx`

**Interfaces:**
- Consumes: `GRAVITY_MPS2`, `RAPID_ACCELERATION_MPS2`, `HARSH_BRAKE_MPS2` from `../utils/drivingThresholds` (Task 5).
- Produces: `getSmoothnessBand(magnitude: number): 'smooth' | 'moderate' | 'harsh'` and `SmoothnessGauge: React.FC<{magnitude: number}>`, both exported from `SmoothnessGauge.tsx`.

- [ ] **Step 1: Write the failing test**

Create `mobile-expo/src/components/__tests__/SmoothnessGauge.test.tsx`:

```tsx
import React from 'react';
import {render, screen} from '@testing-library/react-native';
import {getSmoothnessBand, SmoothnessGauge} from '../SmoothnessGauge';

describe('getSmoothnessBand', () => {
  it('returns smooth near resting gravity', () => {
    expect(getSmoothnessBand(9.81)).toBe('smooth');
  });

  it('returns moderate for a mid deviation', () => {
    expect(getSmoothnessBand(9.81 + 3.2)).toBe('moderate');
  });

  it('returns harsh for a large deviation', () => {
    expect(getSmoothnessBand(9.81 + 4.0)).toBe('harsh');
  });
});

describe('SmoothnessGauge', () => {
  it('renders the band label and magnitude', () => {
    render(<SmoothnessGauge magnitude={9.81} />);

    expect(screen.getByText(/Smooth/)).toBeTruthy();
    expect(screen.getByText(/9\.8 m\/s²/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile-expo && npm test -- src/components/__tests__/SmoothnessGauge.test.tsx`
Expected: FAIL — `Cannot find module '../SmoothnessGauge'`

- [ ] **Step 3: Implement the component**

Create `mobile-expo/src/components/SmoothnessGauge.tsx`:

```tsx
import React from 'react';
import {Text, View} from 'react-native';
import {useAppTheme} from '../theme/appTheme';
import {GRAVITY_MPS2, HARSH_BRAKE_MPS2, RAPID_ACCELERATION_MPS2} from '../utils/drivingThresholds';

export type SmoothnessBand = 'smooth' | 'moderate' | 'harsh';

export const getSmoothnessBand = (magnitude: number): SmoothnessBand => {
  const deviation = Math.abs(magnitude - GRAVITY_MPS2);
  if (deviation >= Math.abs(HARSH_BRAKE_MPS2)) {
    return 'harsh';
  }
  if (deviation >= RAPID_ACCELERATION_MPS2) {
    return 'moderate';
  }
  return 'smooth';
};

const BAND_LABEL: Record<SmoothnessBand, string> = {
  smooth: 'Smooth',
  moderate: 'Moderate',
  harsh: 'Harsh',
};

type Props = {
  magnitude: number;
};

export const SmoothnessGauge: React.FC<Props> = ({magnitude}) => {
  const theme = useAppTheme();
  const band = getSmoothnessBand(magnitude);
  const toneColor = band === 'harsh' ? theme.danger : band === 'moderate' ? theme.warning : theme.success;

  return (
    <View style={{flexDirection: 'row', alignItems: 'center'}}>
      <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: toneColor, marginRight: 6}} />
      <Text style={{color: toneColor, ...theme.typography.caption, fontWeight: '700'}}>
        {BAND_LABEL[band]} • {magnitude.toFixed(1)} m/s²
      </Text>
    </View>
  );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mobile-expo && npm test -- src/components/__tests__/SmoothnessGauge.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-expo/src/components/SmoothnessGauge.tsx mobile-expo/src/components/__tests__/SmoothnessGauge.test.tsx
git commit -m "feat: add SmoothnessGauge component"
```

---

### Task 7: Mobile — wire `SmoothnessGauge` into `LiveTrackingLayout`

**Files:**
- Modify: `mobile-expo/src/components/LiveTrackingLayout.tsx`

**Interfaces:**
- Consumes: `SmoothnessGauge` from Task 6; `latestAcceleration: number` now returned by both hooks (Task 5).

- [ ] **Step 1: Add `latestAcceleration` to the `LiveTrackingData` type**

In `mobile-expo/src/components/LiveTrackingLayout.tsx`, add to the `LiveTrackingData` type (after line 19, `paceDelta: string;`):

```ts
  latestAcceleration: number;
```

- [ ] **Step 2: Render the gauge in the TELEMETRY FEED card**

Add the import at the top of the file (after line 6, the `useAppSidebar` import):

```ts
import {SmoothnessGauge} from './SmoothnessGauge';
```

Replace the `paceDelta` text line inside the TELEMETRY FEED card (line 461):

```tsx
              <Text style={{color: '#CFFAFE', ...theme.typography.caption, fontWeight: '700', marginTop: 8}}>{data.paceDelta}</Text>
```

with:

```tsx
              <Text style={{color: '#CFFAFE', ...theme.typography.caption, fontWeight: '700', marginTop: 8}}>{data.paceDelta}</Text>
              <View style={{marginTop: 8}}>
                <SmoothnessGauge magnitude={data.latestAcceleration} />
              </View>
```

- [ ] **Step 3: Typecheck**

Run: `cd mobile-expo && npm run typecheck`
Expected: PASS — both `MapScreen.native.tsx` (via `useLiveTracking`) and `MapScreen.web.tsx` (via `useMockLiveTracking`) now satisfy the extended `LiveTrackingData` type since Task 5 added `latestAcceleration` to both hooks' return values.

- [ ] **Step 4: Manual smoke check (no automated screen test exists for this layout today)**

Run: `cd mobile-expo && npm run web` and open the Live tab.
Expected: The TELEMETRY FEED card shows a colored dot + "Smooth/Moderate/Harsh • N.N m/s²" line below the heading readout, updating as mock frames advance.

- [ ] **Step 5: Commit**

```bash
git add mobile-expo/src/components/LiveTrackingLayout.tsx
git commit -m "feat: render SmoothnessGauge on the live tracking telemetry card"
```

---

### Task 8: Mobile — `vehicleService` granularity param

**Files:**
- Modify: `mobile-expo/src/services/vehicleService.ts`
- Test: `mobile-expo/src/services/__tests__/vehicleService.test.ts` (new)

**Interfaces:**
- Produces: `vehicleService.getVehicleStats(vehicleId: string, granularity?: 'day' | 'week' | 'month')` — `granularity` defaults to `'day'`, sent as a query param.

- [ ] **Step 1: Write the failing test**

Create `mobile-expo/src/services/__tests__/vehicleService.test.ts`:

```ts
import {vehicleService} from '../vehicleService';
import {mockApiGet, mockedApiClient, resetApiClientMocks} from '../../testUtils/mockApiClient';

jest.mock('../apiClient', () => ({
  apiClient: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

const statsResponse = {
  summary: {
    vehicle_id: 'vehicle-1',
    vehicle_name: 'Honda City',
    vehicle_image_url: null,
    fuel_type: 'petrol' as const,
    trip_count: 4,
    active_trip_count: 0,
    total_distance_meters: 40000,
    total_duration_seconds: 7200,
    total_fuel_used_liters: 3.2,
    total_fuel_cost_amount: 420,
    avg_driving_score: 88,
    last_trip_at: '2026-05-16T10:00:00Z',
  },
  trip_trend: [],
  fuel_trend: [],
  events: {harsh_brake_count: 0, rapid_acceleration_count: 0, overspeed_count: 0, total_events: 0},
  recent_trips: [],
};

describe('vehicleService.getVehicleStats', () => {
  beforeEach(() => {
    resetApiClientMocks();
  });

  it('defaults granularity to day', async () => {
    mockApiGet(statsResponse);

    await vehicleService.getVehicleStats('vehicle-1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/vehicles/vehicle-1/stats', {
      params: {granularity: 'day'},
    });
  });

  it('passes through an explicit granularity', async () => {
    mockApiGet(statsResponse);

    await vehicleService.getVehicleStats('vehicle-1', 'month');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/vehicles/vehicle-1/stats', {
      params: {granularity: 'month'},
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile-expo && npm test -- src/services/__tests__/vehicleService.test.ts`
Expected: FAIL — the current call has no second argument and no `params`, so the `toHaveBeenCalledWith` assertion mismatches.

- [ ] **Step 3: Implement the param**

In `mobile-expo/src/services/vehicleService.ts`, replace the `getVehicleStats` method (lines 94-97):

```ts
  getVehicleStats: async (vehicleId: string, granularity: 'day' | 'week' | 'month' = 'day') => {
    const response = await apiClient.get<VehicleStatsRead>(`/api/v1/vehicles/${vehicleId}/stats`, {
      params: {granularity},
    });
    return response.data;
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mobile-expo && npm test -- src/services/__tests__/vehicleService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-expo/src/services/vehicleService.ts mobile-expo/src/services/__tests__/vehicleService.test.ts
git commit -m "feat: add granularity param to vehicleService.getVehicleStats"
```

---

### Task 9: Mobile — `dashboardService.getRecurringInsights` + remove dead heuristic insights

**Files:**
- Modify: `mobile-expo/src/services/dashboardService.ts`
- Test: `mobile-expo/src/services/__tests__/dashboardService.test.ts` (new)

**Interfaces:**
- Produces: `dashboardService.getRecurringInsights(): Promise<RecurringInsight[]>` where `RecurringInsight = {rule_id: string; category: string; tone: 'warning' | 'info' | 'success'; title: string; message: string; metric_label: string; metric_value: string; priority: number}`, exported as a type from `dashboardService.ts`.
- Removes: the `insights` field from `TransformedDashboard` and its computation inside `transformDashboard` (its sole consumer, `DashboardScreen.tsx` line 310, is replaced in Task 10).

- [ ] **Step 1: Write the failing test**

Create `mobile-expo/src/services/__tests__/dashboardService.test.ts`:

```ts
import {dashboardService, type RecurringInsight} from '../dashboardService';
import {mockApiGet, mockedApiClient, resetApiClientMocks} from '../../testUtils/mockApiClient';

jest.mock('../apiClient', () => ({
  apiClient: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

describe('dashboardService.getRecurringInsights', () => {
  beforeEach(() => {
    resetApiClientMocks();
  });

  it('fetches and returns the recurring insights list', async () => {
    const response: RecurringInsight[] = [
      {
        rule_id: 'recurring_harsh_brake_evening',
        category: 'pattern',
        tone: 'warning',
        title: 'Frequent harsh braking',
        message: 'You harsh brake most often in the evening.',
        metric_label: 'Occurrences',
        metric_value: '9 events',
        priority: 9,
      },
    ];
    mockApiGet(response);

    const result = await dashboardService.getRecurringInsights();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/dashboard/insights');
    expect(result).toEqual(response);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile-expo && npm test -- src/services/__tests__/dashboardService.test.ts`
Expected: FAIL — `getRecurringInsights` does not exist on `dashboardService`.

- [ ] **Step 3: Implement `getRecurringInsights` and remove the dead heuristic**

In `mobile-expo/src/services/dashboardService.ts`, add the new exported type near the top (after the `RecentEvent` interface, before `DashboardResponse`, i.e. after line 67):

```ts
export interface RecurringInsight {
  rule_id: string;
  category: string;
  tone: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  metric_label: string;
  metric_value: string;
  priority: number;
}
```

Remove the `insights` field from the `TransformedDashboard` interface (line 121):

```ts
  insights: Array<{type: 'warning' | 'info' | 'success'; message: string}>;
```

Remove the heuristic computation block inside `transformDashboard` (lines 194-227, the `const insights: Array<...> = [];` block through the closing `}` of the last `if/else`).

Remove `insights,` from the object returned by `transformDashboard` (line 316).

Add the new service method to the `dashboardService` object (after `getDashboard`, i.e. after line 355):

```ts
  getRecurringInsights: async (): Promise<RecurringInsight[]> => {
    const response = await apiClient.get<RecurringInsight[]>('/api/v1/dashboard/insights');
    return response.data;
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mobile-expo && npm test -- src/services/__tests__/dashboardService.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck** (confirms the `insights` removal doesn't yet break `DashboardScreen.tsx` — that's fixed in Task 10, which runs immediately after)

Run: `cd mobile-expo && npm run typecheck`
Expected: FAIL — `DashboardScreen.tsx:310` still references `dashboard?.insights[0]`, which no longer exists on `TransformedDashboard`. This is expected; Task 10 fixes it. Do not skip ahead — commit this task's mobile-side change now and let Task 10's own typecheck step confirm the full fix.

- [ ] **Step 6: Commit**

```bash
git add mobile-expo/src/services/dashboardService.ts mobile-expo/src/services/__tests__/dashboardService.test.ts
git commit -m "feat: add dashboardService.getRecurringInsights, remove dead heuristic insights"
```

---

### Task 10: Mobile — `DashboardScreen`: recurring insights list + Best/Worst threshold fix

**Files:**
- Modify: `mobile-expo/src/screens/DashboardScreen.tsx`

**Interfaces:**
- Consumes: `dashboardService.getRecurringInsights()` and `RecurringInsight` type from Task 9.

- [ ] **Step 1: Fetch recurring insights on mount/focus, following the existing `fallbackTrips` pattern**

In `mobile-expo/src/screens/DashboardScreen.tsx`, update the import (line 17-18):

```ts
import {tripsService, type TripRead} from '../services/tripsService';
import {dashboardService, type RecurringInsight} from '../services/dashboardService';
import {useDashboardStore} from '../store/dashboardStore';
```

Add state near `fallbackTrips` (after line 221):

```ts
  const [recurringInsights, setRecurringInsights] = useState<RecurringInsight[]>([]);
```

Add a fetch effect near the `loadFallbackTrips` effect (after that effect block, i.e. after line 266):

```ts
  useEffect(() => {
    const loadRecurringInsights = async () => {
      try {
        const insights = await dashboardService.getRecurringInsights();
        setRecurringInsights(insights);
      } catch {
        setRecurringInsights([]);
      }
    };

    void loadRecurringInsights();
  }, [dashboard]);
```

- [ ] **Step 2: Remove the single-insight fallback and replace `InsightBanner` usage with a horizontal list**

Remove the now-invalid single-insight fallback (lines 310-313):

```ts
  const insight = dashboard?.insights[0] ?? {
    type: 'info' as const,
    message: 'Live trip health looks stable. Keep speed and braking smooth.',
  };
```

In the "Behavior Pulse" card, replace the single `<InsightBanner .../>` call (line 675):

```tsx
            <InsightBanner message={insight.message} type={insight.type} palette={palette} typography={theme.typography} />
```

with a conditional horizontal-scroll list:

```tsx
            {recurringInsights.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 12}}>
                {recurringInsights.map((item) => (
                  <View key={item.rule_id} style={{marginRight: 10, width: 260}}>
                    <InsightBanner
                      message={item.message}
                      type={item.tone}
                      palette={palette}
                      typography={theme.typography}
                    />
                  </View>
                ))}
              </ScrollView>
            ) : null}
```

`ScrollView` is already imported at the top of the file (line 2), so no new import is needed.

- [ ] **Step 3: Fix the Best/Worst vehicle threshold**

Replace line 565:

```tsx
          {bestVehicle && worstVehicle && (dashboard?.vehicles.length ?? 0) > 2 ? (
```

with:

```tsx
          {bestVehicle && worstVehicle && (dashboard?.vehicles.length ?? 0) >= 2 ? (
```

- [ ] **Step 4: Typecheck**

Run: `cd mobile-expo && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Manual smoke check**

Run: `cd mobile-expo && npm run web` and open the Home tab.
Expected: "Behavior Pulse" card shows a horizontally-scrollable row of insight cards when the backend returns recurring insights (or nothing extra if the list is empty — no broken layout). With exactly 2 vehicles seeded, "Vehicle Insights" (Best/Needs Attention) now renders.

- [ ] **Step 6: Commit**

```bash
git add mobile-expo/src/screens/DashboardScreen.tsx
git commit -m "feat: show recurring insights list on dashboard, fix vehicle comparison threshold"
```

---

### Task 11: Mobile — `VehicleAnalyticsScreen`: granularity toggle, score overlay, fuel section

**Files:**
- Modify: `mobile-expo/src/screens/VehicleAnalyticsScreen.tsx`

**Interfaces:**
- Consumes: `vehicleService.getVehicleStats(vehicleId, granularity)` from Task 8. `VehicleStatsRead.trip_trend` items already carry `fuel_used_liters`, `fuel_cost_amount`, `avg_driving_score` (existing type, unchanged).

- [ ] **Step 1: Add granularity state and thread it into `loadStats`**

In `mobile-expo/src/screens/VehicleAnalyticsScreen.tsx`, add state after `stats` (after line 36):

```ts
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('week');
```

Replace `loadStats` (lines 40-51) to use it:

```ts
  const loadStats = async (nextGranularity: 'day' | 'week' | 'month' = granularity) => {
    try {
      setLoading(true);
      setError(null);
      const response = await vehicleService.getVehicleStats(route.params.vehicleId, nextGranularity);
      setStats(response);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };
```

Update the effect that calls it (lines 57-59) to re-run when granularity changes:

```ts
  useEffect(() => {
    void loadStats(granularity);
  }, [route.params.vehicleId, granularity]);
```

- [ ] **Step 2: Extend `trendBars` to carry score alongside distance**

Replace the `trendBars` memo (lines 61-71):

```ts
  const trendBars = useMemo(() => {
    const tripTrend = stats?.trip_trend ?? [];
    const points = tripTrend.slice(-6);
    const maxDistance = Math.max(...points.map((item) => item.distance_meters), 1);

    return points.map((item) => ({
      label: new Date(item.bucket_start).toLocaleDateString('en-IN', {weekday: 'short'}),
      value: `${Math.round((item.distance_meters / 1000) * 10) / 10} km`,
      height: Math.max(16, (item.distance_meters / maxDistance) * 88),
      score: item.avg_driving_score,
      scoreDotBottom: item.avg_driving_score != null ? Math.max(4, (item.avg_driving_score / 100) * 88) : null,
    }));
  }, [stats?.trip_trend]);
```

- [ ] **Step 3: Add a segmented control above the Trip Trend chart and a score-dot overlay per bar**

Replace the "Trip Trend" card (lines 286-315):

```tsx
            <View
              className="mb-4 rounded-[26px] border p-4"
              style={{
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              }}>
              <View className="flex-row items-center justify-between">
                <View style={{flex: 1, paddingRight: 10}}>
                  <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>Trip Trend</Text>
                  <Text className="mt-[3px]" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                    Distance (bars) and score (dots) over time
                  </Text>
                </View>
                <View className="flex-row rounded-full p-1" style={{backgroundColor: theme.cardSoft}}>
                  {(['week', 'month', 'day'] as const).map((option) => {
                    const active = granularity === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setGranularity(option)}
                        className="rounded-full px-3 py-1.5"
                        style={{backgroundColor: active ? theme.card : 'transparent'}}>
                        <Text style={{color: active ? theme.text : theme.textSubtle, ...theme.typography.caption, fontWeight: '700', textTransform: 'capitalize'}}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View className="mt-4 h-[150px] flex-row items-end justify-between">
                {trendBars.length > 0 ? trendBars.map((item) => (
                  <View key={item.label} className="flex-1 items-center justify-end" style={{height: '100%'}}>
                    <View style={{flex: 1, width: 22, justifyContent: 'flex-end'}}>
                      {item.scoreDotBottom != null ? (
                        <View
                          style={{
                            position: 'absolute',
                            bottom: item.scoreDotBottom,
                            left: '50%',
                            marginLeft: -4,
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: theme.success,
                          }}
                        />
                      ) : null}
                      <View
                        style={{
                          width: 22,
                          height: item.height,
                          borderRadius: 11,
                          backgroundColor: theme.accent,
                        }}
                      />
                    </View>
                    <Text className="mt-2" style={{color: theme.textSubtle, ...theme.typography.caption}}>{item.label}</Text>
                  </View>
                )) : (
                  <Text style={{color: theme.textSubtle, ...theme.typography.body}}>
                    Not enough trip history yet to show a trend.
                  </Text>
                )}
              </View>
              <View className="mt-3 flex-row items-center">
                <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent, marginRight: 6}} />
                <Text style={{color: theme.textSubtle, ...theme.typography.caption, marginRight: 14}}>Distance</Text>
                <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: theme.success, marginRight: 6}} />
                <Text style={{color: theme.textSubtle, ...theme.typography.caption}}>Score</Text>
              </View>
            </View>
```

- [ ] **Step 4: Add a Fuel section using data already in `trip_trend`**

Add this new card immediately after the Trip Trend card and before the "Recent Trips" card (i.e. after the closing `</View>` you just edited in Step 3, before the existing line that reads `<View className="rounded-[26px] border p-4" ...>` for Recent Trips):

```tsx
            <View
              className="mb-4 rounded-[26px] border p-4"
              style={{
                backgroundColor: theme.card,
                borderColor: theme.cardBorder,
              }}>
              <Text style={{color: theme.text, ...theme.typography.sectionTitle}}>Fuel</Text>
              <Text className="mb-3 mt-[3px]" style={{color: theme.textSubtle, ...theme.typography.caption}}>
                Usage and cost for this vehicle
              </Text>
              <View className="mb-3 flex-row justify-between">
                <View
                  className="w-[48.5%] rounded-[18px] border p-[14px]"
                  style={{backgroundColor: theme.cardSoft, borderColor: theme.cardBorder}}>
                  <Text className="mb-1.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>Total fuel used</Text>
                  <Text style={{color: theme.text, fontSize: 19, fontWeight: '800'}}>{summary.total_fuel_used_liters.toFixed(1)} L</Text>
                </View>
                <View
                  className="w-[48.5%] rounded-[18px] border p-[14px]"
                  style={{backgroundColor: theme.cardSoft, borderColor: theme.cardBorder}}>
                  <Text className="mb-1.5" style={{color: theme.textSubtle, ...theme.typography.caption}}>Total fuel cost</Text>
                  <Text style={{color: theme.text, fontSize: 19, fontWeight: '800'}}>₹{Math.round(summary.total_fuel_cost_amount)}</Text>
                </View>
              </View>
              <View className="h-[70px] flex-row items-end justify-between">
                {trendBars.length > 0 ? (stats?.trip_trend ?? []).slice(-6).map((item, index) => {
                  const maxCost = Math.max(...(stats?.trip_trend ?? []).slice(-6).map((point) => point.fuel_cost_amount), 1);
                  return (
                    <View key={`${item.bucket_start}-${index}`} className="flex-1 items-center justify-end">
                      <View
                        style={{
                          width: 16,
                          height: Math.max(6, (item.fuel_cost_amount / maxCost) * 54),
                          borderRadius: 8,
                          backgroundColor: theme.warning,
                        }}
                      />
                    </View>
                  );
                }) : (
                  <Text style={{color: theme.textSubtle, ...theme.typography.body}}>
                    Not enough trip history yet to show fuel cost trend.
                  </Text>
                )}
              </View>
            </View>
```

- [ ] **Step 5: Typecheck**

Run: `cd mobile-expo && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Manual smoke check**

Run: `cd mobile-expo && npm run web`, open Garage → any vehicle → Vehicle Analytics.
Expected: Trip Trend card shows a Week/Month/Day segmented control that re-fetches and re-renders bars with a green score dot per bar; a new Fuel card below it shows total liters/cost tiles and a small cost-trend bar row.

- [ ] **Step 7: Commit**

```bash
git add mobile-expo/src/screens/VehicleAnalyticsScreen.tsx
git commit -m "feat: add trend granularity toggle, score overlay, and fuel section to vehicle analytics"
```

---

### Task 12: Mobile — pending-sync counts on the live tracking stats grid

**Files:**
- Modify: `mobile-expo/src/hooks/useLiveTracking.native.ts`
- Modify: `mobile-expo/src/hooks/useMockLiveTracking.ts`

**Interfaces:**
- Produces: two new entries in the existing `stats: Array<{label: string; value: string}>` array both hooks already return — `pending_points` and `pending_events`. No changes to `LiveTrackingLayout.tsx` are needed: it already renders every entry of `data.stats` generically in its "Tracking Health" grid (see `LiveTrackingLayout.tsx` lines 556-572), so new stat entries appear automatically.

The granular sync state itself (`starting`/`recording`/`syncing`/`local_only`/`error`) is already exposed via `data.syncState`/`data.syncLabel` and already drives `syncTone`/`liveBadge` in `LiveTrackingLayout.tsx` — the only missing piece is a visible "how much is still queued" count, which this task adds.

- [ ] **Step 1: Add pending counts to `useLiveTracking.native.ts`**

In the `stats` array inside the hook's return object (lines 787-792), add two entries:

```ts
    stats: [
      {label: 'avg_speed_mps', value: avgSpeedMps.toFixed(1)},
      {label: 'max_speed_mps', value: maxSpeedMps.toFixed(1)},
      {label: 'accuracy_m', value: resolvedPoint.accuracy_m.toFixed(1)},
      {label: 'accepted_events', value: String(acceptedEvents)},
      {label: 'pending_points', value: String(Math.max(0, points.length - acceptedPoints))},
      {label: 'pending_events', value: String(Math.max(0, events.length - acceptedEvents))},
    ],
```

- [ ] **Step 2: Add matching mock pending counts to `useMockLiveTracking.ts`**

In the `stats` array inside this hook's return object (lines 287-292), add two entries:

```ts
    stats: [
      {label: 'avg_speed_mps', value: avgSpeedMps.toFixed(1)},
      {label: 'max_speed_mps', value: maxSpeedMps.toFixed(1)},
      {label: 'accuracy_m', value: currentPoint.accuracy_m.toFixed(1)},
      {label: 'accepted_points', value: String(acceptedPoints)},
      {label: 'pending_points', value: String(Math.max(0, locationPoints.length - acceptedPoints))},
      {label: 'pending_events', value: String(Math.max(0, frame.events - acceptedEvents))},
    ],
```

- [ ] **Step 3: Typecheck**

Run: `cd mobile-expo && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Manual smoke check**

Run: `cd mobile-expo && npm run web`, open the Live tab, start a trip.
Expected: "Tracking Health" grid now shows "pending points" and "pending events" tiles alongside the existing four, counting up while a sync is in flight and settling back toward 0 once accepted.

- [ ] **Step 5: Commit**

```bash
git add mobile-expo/src/hooks/useLiveTracking.native.ts mobile-expo/src/hooks/useMockLiveTracking.ts
git commit -m "feat: surface pending point/event counts on live tracking stats grid"
```

---

### Task 13: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend unit suite**

Run: `cd backend && python -m pytest tests/unit -v`
Expected: PASS, all tests including the new ones from Tasks 1 and 3.

- [ ] **Step 2: Run the full mobile test suite**

Run: `cd mobile-expo && npm test`
Expected: PASS, all tests including the new ones from Tasks 6, 8, and 9.

- [ ] **Step 3: Run mobile typecheck**

Run: `cd mobile-expo && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Manual end-to-end smoke check**

With the backend running (`docker compose up -d --build` or local uvicorn) and seed data loaded (`python -m app.db.seed`), open the mobile web app and verify:
- Live tab: smoothness gauge renders and changes band as mock frames advance; "Tracking Health" grid shows pending points/events counts.
- Home tab: recurring insights row appears (or is cleanly absent) in Behavior Pulse; Best/Worst vehicle card appears with 2+ vehicles.
- Garage → Vehicle Analytics: Week/Month/Day toggle changes the trend chart; score dots appear on bars; Fuel card shows totals and a cost trend.

- [ ] **Step 5: No commit for this task** — it is verification-only. If any step fails, return to the relevant task, fix, and re-commit there.
