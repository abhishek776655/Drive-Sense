# Mobile v2 — All Stats

Date: 2026-10-17. Replaces the interim `src/app/all-stats.tsx` (opened from Home's "All stats" button).

Odo's Statistics screen was the reference. Kept: summary grid, time-period selection, speed distribution,
time at speed, trends, records, streaks, most visited. Dropped: achievements, milestones, compare trips,
GPX imports, trip videos, custom date range, and Odo's menu-of-sub-pages layout (one scrolling page of
Rovy cards instead). No elevation trend: phone altitude is noisy and gain is not stored per trip.

## Page (top to bottom)

1. **Header**: back button and "All Stats", pinned with the progressive blur used on the trip page.
2. **Chips**: `Week · Month · Year · All` (default Month) and a vehicle chip (`All vehicles ▾`, opens the
   Logbook `OptionSheet` with the user's vehicles). The chips drive every card below.
   Week = since Monday, Month = since the 1st, Year = since 1 January, all in the user's time zone.
3. **Summary** card, 3 × 3: Total km, Drives, Avg km / drive; Total time, Avg duration, Avg speed;
   Moving, Idle, Longest drive (km). Icon + small caps label + big value, like `PeriodSummaryCard`.
4. **Trends**: metric pills `Distance · Drive time · Avg speed · Max speed · Max G` over a bar chart.
   Buckets follow the period: Week → 7 days, Month → each day of the month so far, Year → 12 months,
   All → months since the first drive (at most 24, the latest ones). Today's / this month's bar in accent.
   Tapping a bar shows its value above the chart.
5. **Speed distribution**: number of drives by their top speed, in the trip page's bands
   (`0–20 … 100+ km/h`, `SPEED_BANDS`), as vertical bars with counts.
6. **Time at speed**: donut of moving time (or distance, via a `Time · Distance` toggle) per band,
   same colours as the trip page's Time at speed card, with a legend.
7. **Records**: Top speed, Longest drive (km), Longest drive (time), Best score — each row shows the
   value, date and city, and opens that trip. Then **Top driving days**: the 3 days with the most km.
8. **Streaks**: Current and Best (consecutive days with a drive). All-time regardless of the period;
   the card says "All time".
9. **Most visited**: top 5 destination cities (the `tripTitle` rule: last part of the end address),
   with visit counts.

States: skeleton cards while loading; one empty card ("No drives this week" with "Show all time") when
the period has no drives; a retry banner on error (keeps the last data if there was some).

## Backend: `GET /api/v1/stats/overview`

Query: `period` (`week | month | year | all`, default `month`), `vehicle_id` (optional, must be the
user's), `tz` (IANA, default UTC). Ended, not-deleted trips of the user; `close_stale_trips` first.

```json
{
  "period": "month", "since": "2026-10-01T00:00:00+05:30",
  "summary": {"distance_meters": 0, "trip_count": 0, "avg_distance_meters": null,
              "duration_seconds": 0, "avg_duration_seconds": null, "avg_speed_mps": null,
              "moving_seconds": 0, "idle_seconds": 0, "longest_distance_meters": null},
  "trend": {"granularity": "day", "buckets": [{"start": "...", "distance_meters": 0, "duration_seconds": 0,
            "avg_speed_mps": null, "max_speed_mps": null, "max_g": null}]},
  "speed_distribution": [{"label": "0–20", "trips": 0}],
  "time_at_speed": [{"label": "0–20", "seconds": 0, "meters": 0}],
  "records": {"top_speed": RecordTrip | null, "longest_distance": ..., "longest_duration": ...,
              "best_score": ...},
  "top_days": [{"date": "2026-10-12", "distance_meters": 0, "trip_count": 0}],
  "streaks": {"current_days": 0, "best_days": 0},
  "places": [{"name": "Gurugram", "visits": 0}]
}
```

`RecordTrip` = `{trip_id, value, start_time, end_address}`.

- Summary: sums over trips; avg speed = distance / moving time (moving = duration − idle), as on Home.
- Trend: bucket in the user's zone (`date_trunc` on `timezone(tz, start_time)`), filled with empty buckets.
- Speed distribution: trips counted by `max_speed_mps` band; trips without a top speed are skipped.
- Time at speed: per trip, consecutive location points (window `lag`); interval seconds from
  `recorded_at`, speed from the earlier point's `speed_mps`; intervals over 10 minutes or below 5 km/h
  (stopped) are skipped; meters = speed × seconds. Bands as `SPEED_BANDS` (defined once in Python).
- Records and top days: ordered queries with `LIMIT`.
- Streaks: `compute_streak` for current; a new pure `best_streak(days)` for best.
- Places: city = last comma part of `end_address`, trimmed; grouped, top 5 by count.
- Pure helpers (bucket building, band lookup, best streak, city name, period start) are unit tested.

## Mobile

- `statsService.overview({period, vehicleId})` and `statsStore` (filters, data, status, error; request
  number guards stale responses, like `logbookStore`).
- Components under `src/components/stats/`: `StatsSummaryCard`, `TrendCard`, `SpeedDistributionCard`,
  `FleetTimeAtSpeedCard` (reuses the trip page donut drawing), `RecordsCard`, `StreaksCard`, `PlacesCard`.
- Route stays `src/app/all-stats.tsx`. Record rows push `/trip/<id>`.
- Jest: service mapping, store staleness and filter changes, trend bucket labels.

## Revision 2026-10-17 (b)

- Calendar chip after the period chips opens `DateRangeSheet`: **Month** (year stepper, 12-month grid) or
  **Custom** (Monday-first calendar; tap first and last day; future days disabled). Both send
  `period=custom&start=&end=` (inclusive local days). Custom ranges under 62 days get a bar per day, longer
  ones a bar per month. The chip shows the range ("Aug 2026", "3–12 Aug").
- Look aligned with Home: orange hero card (period distance, drives, drive time), Home `BentoTile`s for the
  rest of the summary and for streaks, Home-style section labels, orange trend bars, tinted record icons.
