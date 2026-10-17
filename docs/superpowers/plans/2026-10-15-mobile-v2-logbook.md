# My Logbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Logbook tab as Rovy's Logbook with Odo's search, sort/period chips and month totals: summary card, Your Routes map, Rovy rows, filters and select-to-delete.

**Architecture:** The backend list endpoint gains `sort`, address search and period `totals`; a new `GET /trips/routes` returns thinned route lines for the map. The app gets a `logbookStore` (filters, paging, selection), pure helpers in `utils/logbook.ts`, presentational components in `components/logbook/`, and a rewritten `app/(tabs)/logbook.tsx`.

**Tech Stack:** FastAPI + async SQLAlchemy + pytest; Expo SDK 57, React Native 0.86, TypeScript 6, Zustand, react-native-maps, Jest.

**Spec:** `docs/superpowers/specs/2026-10-15-mobile-v2-logbook-design.md`

## Global Constraints

- App code in `drive-sense-v2/`, backend in `backend/`. Run app commands from `drive-sense-v2/`, backend tests with `cd backend && source .venv/bin/activate && python -m pytest tests/unit -q`.
- No raw colour literals in `src/components/**` or `src/app/**` (token contract test). Use `useAppTheme()`.
- No new npm or pip dependencies.
- Glass controls use `Glass` / `GlassButton`; selected toggles use `fill={c.accentTint}`.
- Page size 20. Routes map: at most 30 routes, ≤ 40 points each.
- Default filters: sort `newest`, period `month`.
- **Do not `git commit`.** Each task ends with a checkpoint (tests + typecheck green).
- Done = `npx tsc --noEmit`, `npx expo lint` 0 errors, `npx jest` green, backend unit tests green, then `docker compose up -d --build backend` and a simulator check.

## File map

| File | Responsibility |
|---|---|
| `backend/app/services/trip_service.py` | `TRIP_SORTS`, `trip_sort_order`, `_trip_list_filters`, totals, `thin_route`, `list_trip_routes` |
| `backend/app/schemas/trip.py` | `TripListTotals`, `TripListPage.totals`, `TripRoutePreview` |
| `backend/app/routers/trips.py` | `sort` param, totals in response, `GET /routes` |
| `backend/tests/unit/test_trip_list.py` | sort mapping, thinning |
| `drive-sense-v2/src/services/tripService.ts` | list params/result, `routes()` |
| `drive-sense-v2/src/utils/logbook.ts` | `periodRange`, `groupByMonth`, `tripTitle`, labels |
| `drive-sense-v2/src/stores/logbookStore.ts` | filters, paging, routes, selection, delete |
| `drive-sense-v2/src/components/StickyHeaderScroll.tsx` | `onNearEnd` prop |
| `drive-sense-v2/src/components/logbook/*` | `TripRow`, `MonthHeader`, `PeriodSummaryCard`, `TripRowSkeleton`, `LogbookControls`, `OptionSheet`, `FilterSheet`, `RoutesOverviewMap{,.native,.web}`, `RoutesFullscreen`, `SelectBar` |
| `drive-sense-v2/src/app/(tabs)/logbook.tsx` | the page |

---

### Task 1: Backend — sort, address search, totals

**Files:** Modify `backend/app/services/trip_service.py` (list_trip_summaries, ~lines 64–160), `backend/app/schemas/trip.py` (TripListPage ~56), `backend/app/routers/trips.py` (get_trips ~23). Create `backend/tests/unit/test_trip_list.py`.

**Interfaces — Produces:**
- `TRIP_SORTS: tuple[str, ...] = ("newest", "oldest", "longest", "fastest", "best", "worst")`
- `trip_sort_order(sort: str) -> list` — SQLAlchemy order clauses; unknown → newest.
- `list_trip_summaries(..., sort="newest") -> tuple[rows, total, totals]` where `totals = {"count", "distance_meters", "duration_seconds", "max_speed_mps"}`.
- Response: `TripListPage.totals: TripListTotals` (`count: int = 0, distance_meters: float = 0, duration_seconds: int = 0, max_speed_mps: float | None = None`).
- Query param `sort: Literal[...] = "newest"`.

- [ ] **Step 1: Failing tests** — `tests/unit/test_trip_list.py`:

```python
from sqlalchemy.dialects import postgresql

from app.services.trip_service import TRIP_SORTS, trip_sort_order


def _sql(clauses):
    return [str(c.compile(dialect=postgresql.dialect())) for c in clauses]


def test_every_sort_has_an_order():
    for sort in TRIP_SORTS:
        assert trip_sort_order(sort), sort


def test_newest_is_the_default_for_unknown_sorts():
    assert _sql(trip_sort_order("nonsense")) == _sql(trip_sort_order("newest"))


def test_score_sorts_put_unscored_trips_last():
    assert "NULLS LAST" in _sql(trip_sort_order("best"))[0]
    assert "NULLS LAST" in _sql(trip_sort_order("worst"))[0]


def test_ties_fall_back_to_newest():
    assert "trips.start_time DESC" in _sql(trip_sort_order("longest"))[-1]
```

Run: FAIL (ImportError).

- [ ] **Step 2: Implement**

```python
TRIP_SORTS = ("newest", "oldest", "longest", "fastest", "best", "worst")


def trip_sort_order(sort: str) -> list:
    """Order clauses for the Logbook sort chip; ties always fall back to newest first."""
    newest = Trip.start_time.desc()
    orders = {
        "newest": [newest],
        "oldest": [Trip.start_time.asc()],
        "longest": [Trip.distance_meters.desc(), newest],
        "fastest": [Trip.max_speed_mps.desc().nulls_last(), newest],
        "best": [Trip.driving_score.desc().nulls_last(), newest],
        "worst": [Trip.driving_score.asc().nulls_last(), newest],
    }
    return orders.get(sort, orders["newest"])
```

Extract the filter list building in `list_trip_summaries` into `_trip_list_filters(*, user_id, vehicle_id, start_time_gte, start_time_lte, min_score, search) -> list` (same body) and add to the search `or_(...)`: `Trip.start_address.ilike(pattern), Trip.end_address.ilike(pattern)`. Add `sort: str = "newest"` param; replace `.order_by(Trip.start_time.desc())` with `.order_by(*trip_sort_order(sort))`.

Totals: one aggregate query over the same joins and filters:

```python
totals_stmt = (
    select(
        func.count(Trip.id),
        func.coalesce(func.sum(Trip.distance_meters), 0),
        func.coalesce(func.sum(Trip.duration_seconds), 0),
        func.max(Trip.max_speed_mps),
    )
    .select_from(Trip)
    .join(Vehicle, Vehicle.id == Trip.vehicle_id)
    .join(VehicleModel, VehicleModel.id == Vehicle.model_id)
    .join(VehicleCompany, VehicleCompany.id == VehicleModel.company_id)
    .where(*filters)
)
count, distance, duration, top = (await db.execute(totals_stmt)).one()
totals = {"count": int(count), "distance_meters": float(distance), "duration_seconds": int(duration), "max_speed_mps": float(top) if top is not None else None}
```

`total = totals["count"]` (drop the separate count query). Return `(rows, total, totals)`.

Schemas: `class TripListTotals(SchemaBase)` as in Interfaces; `TripListPage.totals: TripListTotals = Field(default_factory=TripListTotals)`.

Router: `sort: Literal["newest","oldest","longest","fastest","best","worst"] = Query(default="newest")` (import `Literal` from `typing`), pass through, unpack `trips, total, totals`, `TripListPage(..., totals=TripListTotals(**totals))`. Update any other caller of `list_trip_summaries` (grep) for the 3-tuple.

- [ ] **Step 3:** `python -m pytest tests/unit -q` → all pass. Checkpoint.

---

### Task 2: Backend — `GET /api/v1/trips/routes`

**Files:** `trip_service.py`, `schemas/trip.py`, `routers/trips.py`, `tests/unit/test_trip_list.py`, `tests/unit/test_app_routes.py`.

**Interfaces — Produces:**
- `thin_route(points: list[tuple[float, float]], max_points: int = 40) -> list[tuple[float, float]]` — evenly spaced, keeps first and last.
- `list_trip_routes(db, *, user_id, vehicle_id, start_time_gte, start_time_lte, min_score, search, limit=30) -> list[dict]` → `[{"trip_id", "start_time", "points": [[lat, lng], ...]}]`, newest first, trips with < 2 points omitted.
- Schema `TripRoutePreview(trip_id: UUID, start_time: AwareDatetime, points: list[tuple[float, float]])`.
- Route `GET /trips/routes` → `list[TripRoutePreview]`, `limit: int = Query(30, ge=1, le=50)`, same filters as the list. **Declare it before `@router.get("/{trip_id}")`** or `routes` is parsed as a trip id.

- [ ] **Step 1: Failing tests** (append to `test_trip_list.py`):

```python
from app.services.trip_service import thin_route


def test_thin_route_keeps_short_routes():
    pts = [(0.0, 0.0), (1.0, 1.0)]
    assert thin_route(pts, 40) == pts


def test_thin_route_keeps_ends_and_caps_length():
    pts = [(float(i), 0.0) for i in range(101)]
    out = thin_route(pts, 5)
    assert out == [(0.0, 0.0), (25.0, 0.0), (50.0, 0.0), (75.0, 0.0), (100.0, 0.0)]
```

`test_app_routes.py`: `assert ("/api/v1/trips/routes", "GET") in paths`, and that this route appears before `/api/v1/trips/{trip_id}` GET in `app.routes` order:

```python
    ordered = [route.path for route in app.routes if "GET" in getattr(route, "methods", set())]
    assert ordered.index("/api/v1/trips/routes") < ordered.index("/api/v1/trips/{trip_id}")
```

- [ ] **Step 2: Implement**

```python
def thin_route(points, max_points=40):
    """At most `max_points`, evenly spaced, first and last kept: enough to draw the shape."""
    if len(points) <= max_points or max_points < 2:
        return list(points)
    step = (len(points) - 1) / (max_points - 1)
    return [points[round(i * step)] for i in range(max_points)]


async def list_trip_routes(db, *, user_id, vehicle_id=None, start_time_gte=None, start_time_lte=None, min_score=None, search=None, limit=30):
    filters = _trip_list_filters(user_id=user_id, vehicle_id=vehicle_id, start_time_gte=start_time_gte, start_time_lte=start_time_lte, min_score=min_score, search=search)
    trips = (
        await db.execute(
            select(Trip.id, Trip.start_time)
            .join(Vehicle, Vehicle.id == Trip.vehicle_id)
            .join(VehicleModel, VehicleModel.id == Vehicle.model_id)
            .join(VehicleCompany, VehicleCompany.id == VehicleModel.company_id)
            .where(*filters)
            .order_by(Trip.start_time.desc())
            .limit(limit)
        )
    ).all()
    if not trips:
        return []
    rows = (
        await db.execute(
            select(LocationPoint.trip_id, LocationPoint.latitude, LocationPoint.longitude)
            .where(LocationPoint.trip_id.in_([t.id for t in trips]))
            .order_by(LocationPoint.trip_id, LocationPoint.recorded_at)
        )
    ).all()
    by_trip: dict = {}
    for row in rows:
        by_trip.setdefault(row.trip_id, []).append((float(row.latitude), float(row.longitude)))
    return [
        {"trip_id": t.id, "start_time": t.start_time, "points": thin_route(by_trip[t.id])}
        for t in trips
        if len(by_trip.get(t.id, [])) >= 2
    ]
```

Router (above the `/{trip_id}` GET):

```python
@router.get("/routes", response_model=list[TripRoutePreview])
async def get_trip_routes(
    vehicle_id: UUID | None = Query(default=None),
    start_time_gte: datetime | None = Query(default=None),
    start_time_lte: datetime | None = Query(default=None),
    min_score: int | None = Query(default=None, ge=0, le=100),
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=30, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TripRoutePreview]:
    """Route lines for the Logbook map: newest first, each thinned to about 40 points."""
    routes = await list_trip_routes(db, user_id=user.id, vehicle_id=vehicle_id, start_time_gte=start_time_gte, start_time_lte=start_time_lte, min_score=min_score, search=search, limit=limit)
    return [TripRoutePreview(**r) for r in routes]
```

- [ ] **Step 3:** backend unit tests pass; `cd .. && docker compose up -d --build backend`; `curl` the two endpoints with a demo token to confirm shape. Checkpoint.

---

### Task 3: App service + `utils/logbook.ts`

**Files:** Modify `src/services/tripService.ts`. Create `src/utils/logbook.ts`, `src/utils/__tests__/logbook.test.ts`.

**Interfaces — Produces:**

```ts
// tripService.ts
export type TripSort = 'newest' | 'oldest' | 'longest' | 'fastest' | 'best' | 'worst';
export type TripListParams = {limit?: number; offset?: number; sort?: TripSort; search?: string; vehicleId?: string | null; minScore?: number | null; from?: string | null};
export type TripListTotals = {count: number; distance_meters: number; duration_seconds: number; max_speed_mps: number | null};
export type TripListResult = {items: TripSummary[]; total: number; totals: TripListTotals};
export type TripRoutePreview = {trip_id: string; start_time: string; points: [number, number][]};
tripService.list(params?: TripListParams): Promise<TripListResult>
tripService.routes(params?: Omit<TripListParams, 'offset' | 'sort'>): Promise<TripRoutePreview[]>
// utils/logbook.ts
export type Period = 'week' | 'month' | 'last30' | 'year' | 'all';
export const PERIODS: {value: Period; label: string; empty: string}[];
export const SORTS: {value: TripSort; label: string}[];
export const periodRange: (period: Period, now?: Date) => Date | null; // start (local), null = all time
export interface MonthGroup {key: string; title: string; items: TripSummary[]; distanceM: number; durationS: number; topMps: number | null}
export const groupByMonth: (items: TripSummary[]) => MonthGroup[]; // keeps input order
export const tripTitle: (t: Pick<TripSummary, 'start_address' | 'end_address'>) => string;
```

Server params mapping in `list`/`routes`: `limit, offset, sort, search (omit if blank), vehicle_id, min_score, start_time_gte: from`.

- [ ] **Step 1: Failing tests** `src/utils/__tests__/logbook.test.ts`:

```ts
import {groupByMonth, periodRange, tripTitle} from '../logbook';
import type {TripSummary} from '../../services/tripService';

const trip = (start: string, km = 1, overrides: Partial<TripSummary> = {}): TripSummary => ({
  id: start, vehicle_name: 'City', state: 'ended', start_time: start, end_time: start, distance_meters: km * 1000, duration_seconds: 600,
  driving_score: 90, max_speed_mps: 10, start_address: null, end_address: null, event_count: 0, ...overrides,
});

describe('periodRange', () => {
  const now = new Date(2026, 9, 15, 14, 30); // Thu 15 Oct 2026, local
  it('starts the week on Monday at midnight', () => {
    expect(periodRange('week', now)).toEqual(new Date(2026, 9, 12));
  });
  it('starts the month, year and last 30 days correctly', () => {
    expect(periodRange('month', now)).toEqual(new Date(2026, 9, 1));
    expect(periodRange('year', now)).toEqual(new Date(2026, 0, 1));
    expect(periodRange('last30', now)).toEqual(new Date(2026, 8, 15));
  });
  it('is null for all time', () => {
    expect(periodRange('all', now)).toBeNull();
  });
  it('treats Sunday as the end of the week', () => {
    expect(periodRange('week', new Date(2026, 9, 18, 9))).toEqual(new Date(2026, 9, 12));
  });
});

describe('groupByMonth', () => {
  it('groups consecutive trips by local month with totals', () => {
    const groups = groupByMonth([trip('2026-10-11T14:00:00Z', 5), trip('2026-10-02T09:00:00Z', 2), trip('2026-09-20T09:00:00Z', 3)]);
    expect(groups.map((g) => g.items.length)).toEqual([2, 1]);
    expect(groups[0].title).toBe('October 2026');
    expect(groups[0].distanceM).toBe(7000);
    expect(groups[0].durationS).toBe(1200);
  });
});

describe('tripTitle', () => {
  it('uses the first part of the end address, then the start, then Drive', () => {
    expect(tripTitle({start_address: 'A, X', end_address: 'Hall 14, South East Delhi'})).toBe('Hall 14');
    expect(tripTitle({start_address: 'India Gate, New Delhi', end_address: null})).toBe('India Gate');
    expect(tripTitle({start_address: null, end_address: null})).toBe('Drive');
  });
});
```

Note `tripTitle` takes the part before the first comma — but `"New Delhi"` alone stays `"New Delhi"`.

- [ ] **Step 2: Implement** `utils/logbook.ts`:

```ts
import type {TripSort, TripSummary} from '../services/tripService';

export type Period = 'week' | 'month' | 'last30' | 'year' | 'all';

export const PERIODS: {value: Period; label: string; empty: string}[] = [
  {value: 'week', label: 'This week', empty: 'No drives this week'},
  {value: 'month', label: 'This month', empty: 'No drives this month'},
  {value: 'last30', label: 'Last 30 days', empty: 'No drives in the last 30 days'},
  {value: 'year', label: 'This year', empty: 'No drives this year'},
  {value: 'all', label: 'All time', empty: 'No drives yet'},
];

export const SORTS: {value: TripSort; label: string}[] = [
  {value: 'newest', label: 'Newest first'},
  {value: 'oldest', label: 'Oldest first'},
  {value: 'longest', label: 'Longest'},
  {value: 'fastest', label: 'Fastest'},
  {value: 'best', label: 'Best score'},
  {value: 'worst', label: 'Worst score'},
];

/** Local start of the period (weeks start on Monday); null for all time. */
export const periodRange = (period: Period, now: Date = new Date()): Date | null => {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (period) {
    case 'week':
      return new Date(y, m, d - ((now.getDay() + 6) % 7));
    case 'month':
      return new Date(y, m, 1);
    case 'last30':
      return new Date(y, m, d - 30);
    case 'year':
      return new Date(y, 0, 1);
    default:
      return null;
  }
};

export interface MonthGroup {
  key: string;
  title: string;
  items: TripSummary[];
  distanceM: number;
  durationS: number;
  topMps: number | null;
}

/** Consecutive trips in the same local month, in the order given, with month totals. */
export const groupByMonth = (items: TripSummary[]): MonthGroup[] => {
  const groups: MonthGroup[] = [];
  for (const item of items) {
    const at = new Date(item.start_time);
    const key = `${at.getFullYear()}-${at.getMonth()}`;
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = {key, title: at.toLocaleDateString('en-IN', {month: 'long', year: 'numeric'}), items: [], distanceM: 0, durationS: 0, topMps: null};
      groups.push(group);
    }
    group.items.push(item);
    group.distanceM += item.distance_meters;
    group.durationS += item.duration_seconds;
    if (item.max_speed_mps != null) {
      group.topMps = Math.max(group.topMps ?? 0, item.max_speed_mps);
    }
  }
  return groups;
};

/** Card title: where the drive ended (its first part), else where it started, else "Drive". */
export const tripTitle = ({start_address, end_address}: {start_address: string | null; end_address: string | null}): string =>
  (end_address ?? start_address)?.split(',')[0].trim() || 'Drive';
```

Check `toLocaleDateString('en-IN', {month: 'long', year: 'numeric'})` gives "October 2026" under Jest (Node ICU). If it differs, build the title from a month-name array instead.

`tripService.ts`: update types per Interfaces and:

```ts
const toQuery = (p: TripListParams = {}) => ({
  limit: p.limit,
  offset: p.offset,
  sort: p.sort,
  search: p.search?.trim() || undefined,
  vehicle_id: p.vehicleId ?? undefined,
  min_score: p.minScore ?? undefined,
  start_time_gte: p.from ?? undefined,
});

export const tripService = {
  list: async (p: TripListParams = {}): Promise<TripListResult> => {
    const {data} = await apiClient.get<TripListResult>('/api/v1/trips', {params: toQuery({limit: 20, offset: 0, ...p})});
    return {items: data.items, total: data.total, totals: data.totals ?? {count: data.total, distance_meters: 0, duration_seconds: 0, max_speed_mps: null}};
  },
  routes: async (p: Omit<TripListParams, 'offset' | 'sort'> = {}): Promise<TripRoutePreview[]> =>
    (await apiClient.get<TripRoutePreview[]>('/api/v1/trips/routes', {params: toQuery({limit: 30, ...p})})).data,
};
```

(The `totals` fallback keeps the app working against production until it is deployed.)

- [ ] **Step 3:** `npx jest src/utils/__tests__/logbook.test.ts && npx tsc --noEmit`. The old `logbook.tsx` uses `tripService.list()` returning an array — change that call to `(await tripService.list()).items` so typecheck passes until Task 9. Checkpoint.

---

### Task 4: `logbookStore`

**Files:** Create `src/stores/logbookStore.ts`, `src/stores/__tests__/logbookStore.test.ts`.

**Interfaces — Produces:**

```ts
export interface LogbookFilters {search: string; sort: TripSort; period: Period; vehicleId: string | null; minScore: number | null}
export const DEFAULT_FILTERS: LogbookFilters; // '', 'newest', 'month', null, null
interface LogbookState {
  filters: LogbookFilters;
  items: TripSummary[]; total: number; totals: TripListTotals | null; routes: TripRoutePreview[];
  status: 'idle' | 'loading' | 'ready' | 'error'; loadingMore: boolean; error: string | null;
  selecting: boolean; selected: string[]; deleting: boolean;
  setFilters: (patch: Partial<LogbookFilters>) => Promise<void>; // merges, reloads page 1 + routes
  load: () => Promise<void>;      // page 1 + routes, keeps old items visible while loading
  loadMore: () => Promise<void>;  // next page when items.length < total
  startSelect: () => void; stopSelect: () => void; toggle: (id: string) => void; selectAll: () => void;
  deleteSelected: () => Promise<{deleted: number; failed: number}>;
}
export const useLogbookStore: UseBoundStore<StoreApi<LogbookState>>;
```

Rules: each `load` gets a request number; a response for an older request is dropped (fast typing in search). `from` = `periodRange(period)?.toISOString() ?? null`. `deleteSelected` calls `tripUploadApi.remove` sequentially, removes deleted ids from `items`, decrements `total`, keeps failed ids selected, leaves select mode when nothing failed, then `load()` to refresh totals and routes.

- [ ] **Step 1: Failing tests** (mock `../../services/tripService` with `tripService: {list, routes}`, `tripUploadApi: {remove}`):

```ts
it('loads the first page and routes with the default month filter', …)          // list called with sort newest, from = start of month ISO; routes called
it('appends the next page on loadMore and stops at total', …)                     // total 25: second call offset 20; third loadMore makes no call
it('drops a stale response when filters change mid-flight', …)                    // first list resolves after second; items equal the second response
it('setFilters resets paging', …)                                                 // after loadMore, setFilters({sort:'fastest'}) → list called with offset 0
it('deletes selected trips one by one and keeps failures selected', …)            // remove rejects for 'b': result {deleted:1, failed:1}, selected ['b'], items without 'a'
```

Write these out fully with `mockResolvedValueOnce` fixtures built by a `trip(id)` helper like Task 3's.

- [ ] **Step 2: Implement** the store per Interfaces and rules (use `getApiErrorMessage(e, 'Could not load your drives.')`).

- [ ] **Step 3:** jest + tsc green. Checkpoint.

---

### Task 5: `StickyHeaderScroll` — `onNearEnd`, header slot

**Files:** Modify `src/components/StickyHeaderScroll.tsx`.

- Add optional `onNearEnd?: () => void`: in the existing `onScroll` (`Animated.event` with `listener`), call it when `layoutMeasurement.height + contentOffset.y >= contentSize.height - 400`, at most once per content height (remember the last height it fired for).
- Behaviour of Home is unchanged (prop optional). Checkpoint: tsc + jest.

---

### Task 6: Row, month header, summary, skeleton

**Files:** Create in `src/components/logbook/`: `TripRow.tsx`, `MonthHeader.tsx`, `PeriodSummaryCard.tsx`, `TripRowSkeleton.tsx`, `StatChip.tsx`.

- `StatChip({icon, color, label})` — pill, background `withAlpha(color, 0.12)`, `Ionicons` 13 in `color`, `AppText` 14 extrabold; padding 6/10, radius 99.
- `TripRow({trip, selecting, selected, onPress})` — `Card` padding 16, row: left column width 64 centred: weekday (12 bold secondary, `'en-IN', {weekday: 'short'}`), day number (30 black), `HH:MM` 24 h (12 semibold tertiary, `fontVariant: ['tabular-nums']`); a hairline divider; right flex: `tripTitle(trip)` (18 black, 1 line), chips row (wrap, gap 6): `StatChip map blue "{formatKm} km"`, `StatChip time cyan formatDuration`, `StatChip speedometer red "{formatKmh(max_speed_mps)} km/h"`. Far right: chevron (`textTertiary`), or in select mode a 24 px check circle (`checkmark-circle` accent when selected, `ellipse-outline` tertiary otherwise). Whole card is a `Pressable` with accessibilityLabel "Drive on {date}, {title}" and `accessibilityState={{selected}}` in select mode.
- `MonthHeader({title, count, distanceM, durationS, topMps})` — row: title (22 black, secondary tone per Rovy) + count badge (circle `c.control`, 13 black); under it muted "84.3 km · 3h 10m · top 108 km/h" (13 semibold tertiary). Margin top 18.
- `PeriodSummaryCard({totals})` — `Card` padding 18, three columns split by hairline dividers, each: icon (route `git-branch`? use `analytics` accent / `map` amber / `stopwatch` accent) + value (26 black) + caps label (11 extrabold tertiary, letterSpacing 0.8): DRIVES `totals.count`, TOTAL KM `formatKm`, TIME `formatDuration`.
- `TripRowSkeleton` — pulsing block shaped like a row (copy the pulse from `trip/TripDetailSkeleton.tsx`).

Checkpoint: tsc + lint + jest (token contract).

---

### Task 7: Controls, option sheet, filter sheet

**Files:** Create `components/logbook/LogbookControls.tsx`, `OptionSheet.tsx`, `FilterSheet.tsx`.

- `LogbookControls({filters, onSearch, onOpenSort, onOpenPeriod, onOpenFilter, filterActive, selecting, onToggleSelect})`:
  - Search: `Glass` radius 18 height 44 row: `search` icon, `TextInput` (placeholder "Search place or vehicle…", `returnKeyType="search"`, value local state, 300 ms debounce → `onSearch`), clear `close-circle` when non-empty.
  - Chips row below (gap 8, wrap): two `GlassButton`s height 34 (sort: `swap-vertical` + label + `chevron-down`; period: `time-outline` + label + `chevron-down`); flex spacer; `MapButton`s size 34: `options-outline` (filter; small accent dot absolutely positioned when `filterActive`), `checkmark-circle-outline` / "Cancel" text button when `selecting`.
- `OptionSheet<T>({visible, title, options: {value: T; label: string}[], value, onPick, onClose})` — `BottomSheet` with rows (as in `VehiclePickerSheet`), check on the current one; picking closes.
- `FilterSheet({visible, vehicleId, minScore, onApply, onClose})` — `BottomSheet` "Filters": section "Vehicle" (All + `useVehicleStore` vehicles, single choice rows), section "Minimum score" (segmented Any / 70+ / 90+), footer: "Reset" (text) and "Apply" (accent pill). Local draft state; Apply calls `onApply({vehicleId, minScore})`. Loads vehicles on open (`useVehicleStore.load`).

Checkpoint.

---

### Task 8: Your Routes map

**Files:** Create `components/logbook/RoutesOverviewMap.tsx` (anchor), `.native.tsx`, `.web.tsx`, `RoutesFullscreen.tsx`.

**Interfaces:** `RoutesOverviewMap({routes, interactive?, onOpenTrip, onExpand?})`; `RoutesFullscreen({visible, routes, onClose, onOpenTrip})`.

- Native: `MapView` (static unless `interactive`), region from `routeRegion(all points flattened)`. One `Polyline` per route: `strokeColor` accent, `strokeWidth` 4, opacity via `withAlpha(c.accent, i === 0 ? 1 : 0.45)` (newest first so index 0 is latest), `tappable`, `onPress={() => onOpenTrip(route.trip_id)}`. Start dot (green 10 px) only on the latest route. Expand `MapButton` top-right when `onExpand`. Card height 220, radius card.
- Web: SVG polylines like `trip/TripRouteMap.web.tsx`, all routes projected together.
- Fullscreen: `Modal` with interactive map + close `MapButton`.
- Hidden by the page when `routes.length === 0`.

Checkpoint.

---

### Task 9: Select bar and the page

**Files:** Create `components/logbook/SelectBar.tsx`; rewrite `src/app/(tabs)/logbook.tsx`.

- `SelectBar({count, total, onSelectAll, onDelete, deleting})` — absolute above the tab bar (`bottom: useTabBarInset(false) - TAB_BAR space` — use `tabBarLayout` helpers the way `ListScreen` does), `Glass` radius 28 row: "Select all" text button, flex, `GlassButton` tint `withAlpha(c.red, 0.78)` "Delete {count} drive(s)" (disabled at 0; spinner while deleting).
- Page:
  - `StickyHeaderScroll kicker="My" title="Logbook"` with `refreshControl` (calls `load`) and `onNearEnd={loadMore}`, bottom padding = tab bar inset + (selecting ? 80 : 0).
  - On focus (`useFocusEffect`): `load()`.
  - Content order: `LogbookControls`, error card (retry), `PeriodSummaryCard` (when totals), "Your Routes" `SectionTitle`-style row + "{routes.length} drives" + `RoutesOverviewMap` (when routes), then list:
    - first load with no items → 4 `TripRowSkeleton`;
    - empty → message per spec (period empty text + "Show all time" button when period ≠ all and no search/filter; "No drives match" + "Clear filters" when search/filter active);
    - sort `newest`/`oldest` → `groupByMonth(items)` with `MonthHeader` + rows; other sorts → rows without headers;
    - `loadingMore` → `ActivityIndicator` at the end.
  - Row press: select mode → `toggle(id)`; else `router.push('/trip/' + id)`.
  - Sheets: sort/period `OptionSheet`s, `FilterSheet` (`filterActive = vehicleId != null || minScore != null`).
  - Delete flow: confirm `Alert` "Delete {n} drives?" / "This can't be undone." → `deleteSelected()`; if `failed > 0` alert "{deleted} of {n} deleted. Try again for the rest."
  - `SelectBar` when `selecting`.

- [ ] **Verify:** tsc, lint 0 errors, jest green, backend tests green; rebuild backend; simulator (Logbook tab): default month shows summary, routes and month sections; switch period to All time and sort to Fastest (no headers); search "Delhi"; filter by a vehicle (dot shows); tap a route → trip page; select two trips → delete → gone and totals update; empty period message. Screenshot light + dark.
- [ ] Update `docs/superpowers/specs/2026-10-15-mobile-v2-logbook-design.md` if anything differs. Checkpoint; report; do not commit.

## Self-review notes

- Spec coverage: layout 1–8 → Tasks 6–9; select mode → 4, 9; filter sheet → 7; empty/error → 9; backend → 1–2; testing → 1–4, 9.
- Spec said Select/Filter sit right of the title row; they are placed at the end of the chip row instead, because the title row already holds the Settings gear. Update the spec in Task 9.
