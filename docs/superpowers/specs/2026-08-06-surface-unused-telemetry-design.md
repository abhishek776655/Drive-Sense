# Surface Unused Telemetry Data — Design

**Date:** 2026-08-06
**Status:** Approved for planning

## Context

A codebase survey found six pieces of data already computed by backend services or mobile hooks but never rendered in the UI, plus one UI threshold bug. This spec covers wiring that existing data into the UI. It does not add new backend computation beyond two small extensions (trend granularity, recurring-insight aggregation) — everything else reuses fields that already exist in current API responses.

Out of scope (deferred to future specs): dead-tap wiring (notification bell, settings icon, profile menu, "Add Vehicle" in selector sheet, trip share button), trip sharing/export, driver achievements/streaks, real profile/account editing, idle-time insights, weekly speed-band aggregate. These are independent subsystems and will be brainstormed separately.

## Items covered

1. Live g-force/smoothness gauge (LiveTripCard)
2. Live tracking stats strip — avg/max speed, GPS accuracy (MapScreen)
3. Pending-sync indicator (MapScreen)
4. Cross-trip recurring insights (Dashboard)
5. Vehicle trip-trend chart: week/month/day toggle + distance-vs-score overlay (VehicleAnalytics)
6. Per-vehicle fuel cost/usage summary + fuel trend (VehicleAnalytics)
7. Best/Worst vehicle comparison threshold fix (Dashboard): `> 2` → `>= 2` vehicles

## Backend changes

### `_get_trip_trend` granularity (item 5)

`backend/app/services/dashboard_service.py:153`. Add `granularity: Literal["day", "week", "month"]` param (default `"day"`), pass to `func.date_trunc(granularity, Trip.start_time)`. Widen lookback window per granularity to keep a reasonable number of buckets:
- `day` → 30 days (current `DASHBOARD_TREND_DAYS`, unchanged)
- `week` → 12 weeks
- `month` → 12 months

Expose as optional query param `granularity` on `GET /vehicles/{id}/stats` only. `GET /dashboard` keeps daily (unaffected — omitting the param preserves current behavior exactly). `TrendPoint` schema unchanged — `distance_meters` and `avg_driving_score` are already on the same row.

### Recurring insights (item 4)

New function `generate_recurring_insights(db, user_id, days=30)` in `trip_insight_service.py`. Query `Event` joined to `Trip`, filtered to the user's trips in the last 30 days across all vehicles. Group by `event_type` + time-of-day bucket (morning/afternoon/evening/night, derived from `Event.occurred_at` hour). Rank groups by count descending, emit top 2-3 as existing `TripInsight`-shaped dataclass (reuse category/tone/title/message/metric_label/metric_value/priority fields), with new `rule_id`s like `recurring_harsh_brake_evening`. If fewer than a minimum threshold of events exist (e.g. < 3 total in window), return empty list — no forced/synthetic insight.

New endpoint: `GET /dashboard/insights` → `list[TripInsight]`. New schema not needed — reuse `TripInsightRead` from `schemas/trip.py`.

### Fuel (item 6)

No backend change. `VehicleStatsResponse.trip_trend` already includes `fuel_used_liters`/`fuel_cost_amount` per bucket alongside distance/score; `VehicleStatsSummary` already has `total_fuel_used_liters`/`total_fuel_cost_amount`.

## Mobile changes

### LiveTripCard — g-force gauge (item 1)

`useLiveTracking.native.ts` already computes `latestAcceleration.magnitude`. Add a small gauge (radial or bar) to `LiveTripCard.tsx`, replacing the current vague `paceDelta` text. Three-band coloring reusing existing thresholds already defined in `useLiveTracking.native.ts`: smooth (below rapid-accel/harsh-brake thresholds), moderate, harsh (`≥ 3.0 m/s²` accel or `≤ -3.5 m/s²` brake) — same constants as event detection, no new thresholds invented.

### MapScreen — stats strip + sync indicator (items 2, 3)

New compact horizontal strip on `MapScreen.native.tsx`: avg speed, max speed, GPS accuracy, read directly from the hook's existing `stats` array. Sync indicator in the same area shows the granular `sessionSync` state (`starting/recording/syncing/local_only/error`) plus a pending count (`points.length - acceptedPoints`, `events.length - acceptedEvents`), replacing today's single collapsed `syncLabel` string.

### Dashboard — recurring insights list (item 4)

Replace the single insight banner with a small horizontal-scroll list (2-3 cards) fed by `GET /dashboard/insights`. Same visual treatment as the current banner (tone-colored, icon, title/message) repeated per card. If the endpoint returns empty, hide the section entirely — no empty-state banner forced into view.

### VehicleAnalytics — trend toggle + fuel section (items 5, 6)

Segmented control (Week / Month / Day, default Week) above the existing trip-trend bar chart, driving the new `granularity` query param on `GET /vehicles/{id}/stats`. Chart becomes dual-metric: bars for distance, line overlay for score, using the chart library already in use for `trip_trend`. New "Fuel" section below: summary tiles (total liters, total cost) from `VehicleStatsSummary`, plus a trend sparkline/bar using `fuel_used_liters`/`fuel_cost_amount` already present in the same `trip_trend` buckets returned by the same request — no extra fetch.

### Dashboard — Best/Worst threshold fix (item 7)

`DashboardScreen.tsx`: change the vehicle-count gate from `vehicles.length > 2` to `vehicles.length >= 2`.

## Error handling & fallback behavior

- `/dashboard/insights` empty or erroring → insights section hidden, no broken UI.
- `granularity` param omitted → backend defaults to `"day"`, identical to current behavior; existing callers unaffected.
- MapScreen stats strip / sync indicator render only while a live session is active (same lifecycle as existing sync label).

## Testing

- Backend (`backend/tests/unit/`): granularity bucketing for `_get_trip_trend` (day/week/month, partial-period edges), `generate_recurring_insights` grouping/ranking and the empty-window case.
- Mobile: colocated `__tests__/` per touched component (gauge, stats strip, sync indicator, insights list, trend toggle, fuel tiles), following existing `mockApiClient.ts` pattern.
