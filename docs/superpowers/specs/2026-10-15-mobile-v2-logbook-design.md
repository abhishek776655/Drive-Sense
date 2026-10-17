# DriveSense v2 — My Logbook

Date: 2026-10-15
Status: approved in brainstorm, awaiting spec review
App: `drive-sense-v2/` (Expo SDK 57). Builds on the foundation and trip-detail specs (2026-10-10, 2026-10-13).

## Goal

Replace the interim Logbook list with Rovy's Logbook, plus Odo's search, sort/period chips and month totals. Tapping a drive opens the trip page (`/trip/[id]`, already built).

## Decisions

| Topic | Decision |
|---|---|
| Scope | Summary card, Your Routes map, search, sort, period, filters, select-to-delete. **Not now:** Tracks tab (grouping by route), Compare. |
| Period | Dropdown chip: This week · **This month** (default) · Last 30 days · This year · All time. Summary, routes map and list all follow it. |
| Sort | Dropdown chip: Newest first (default) · Oldest first · Longest · Fastest · Best score · Worst score. |
| Card | Rovy row exactly: day block, title, chips **km · min · top km/h**, chevron. No route drawing, no score chip. |
| From Odo | Search bar, the two chips, month header totals. Not taken: per-card map, per-card share, notes/tags. |

## Layout (top to bottom)

1. **Header** — "My / Logbook" with the gear, pinned with the progressive blur (`StickyHeaderScroll`). Right of the title row: glass **Select** (✓) and **Filter** buttons; the filter shows a dot when a filter is active.
2. **Search** — glass field "Search place or vehicle…", 300 ms debounce, clear button.
3. **Chips** — `[↓ Newest first ▾] [🕒 This month ▾]`; each opens a small glass menu (bottom sheet) of options with a check on the current one.
4. **Summary card** — three columns with dividers: Drives · Total km · Time (icon above each, Rovy style). Totals cover the whole filtered period, not just loaded rows.
5. **Your Routes** — section title + "N drives"; 220 pt map card with every route in the period (most recent 30 when more), plain accent lines at partial opacity, latest drive full opacity. Map is static; tapping a route line opens that trip. Expand button opens a full-screen version (pan/zoom). Hidden when no drive has a route.
6. **List** — month sections. Header: "October 2026" + count badge, and a muted line "84.3 km · 3h 10m · top 108 km/h" (month totals of loaded rows; when sorted by anything other than date, sections are replaced by one plain list without month headers).
7. **Row** (`TripRow`) — card: left day block (weekday short, day number large, HH:MM mono-ish), right: title (first part of end address → start address → "Drive"), chips row: blue km, cyan min, red top km/h (Rovy colours: tinted pill + icon), chevron. Tap → `/trip/[id]`.
8. **Paging** — 20 rows per page; next page loads near the end; pull to refresh; refetch on tab focus (deleted / edited trips disappear or update).

## Select mode

Tapping ✓ turns on select: each row shows a check circle instead of the chevron, tapping toggles it; header button becomes "Cancel". A glass bar slides up above the tab bar: "Select all" · "Delete N drives" (red). Delete asks "Delete N drives? This can't be undone.", then deletes one by one (existing `DELETE /trips/{id}`); failures are reported ("2 of 3 deleted") and the failed ones stay selected.

## Filter sheet

Glass bottom sheet (existing `BottomSheet`): Vehicle (All + each vehicle), Minimum score (Any · 70+ · 90+). Reset and Apply. Date range comes from the Period chip.

## Empty / error states

- No drives in period: "No drives this month" + button "Show all time".
- No search / filter results: "No drives match" + "Clear filters".
- No drives at all: "No drives yet. Start one from Drive."
- Load error: card with message and Retry (existing `ListScreen` pattern).
- Loading: skeleton rows.

## Backend — `GET /api/v1/trips` additions (backward compatible)

- `sort`: `newest|oldest|longest|fastest|best|worst` (default `newest`). Longest = distance; best/worst = score with nulls last.
- Search also matches `start_address` and `end_address`.
- Response gains `totals`: `{count, distance_meters, duration_seconds, max_speed_mps}` over all rows matching the filters (not just the page).
- New endpoint `GET /api/v1/trips/routes` with the same filter params (`vehicle_id`, `start_time_gte/lte`, `min_score`, `search`) and `limit` (default 30, max 50): returns `[{trip_id, start_time, points: [[lat, lng], …]}]`, newest first, each route thinned evenly to ≤ 40 points (first and last kept), trips without points omitted. Kept separate from the list so pages stay small.
- Unit tests: sort mapping, totals, route thinning; route-registration test for `/trips/routes` (declared before `/{trip_id}`).

## App

- `services/tripService.ts`: `tripService.list(params)` returns `{items, total, totals}`; `tripService.routes(params)`.
- `stores/logbookStore.ts`: filters (`search`, `sort`, `period`, `vehicleId`, `minScore`), `items`, `totals`, `routes`, paging (`loadFirst`, `loadMore`, `refresh`), select state (`selecting`, `selected`, `toggle`, `selectAll`, `deleteSelected`). Period → `start_time_gte` computed in local time.
- `utils/logbook.ts` (pure, tested): `periodRange(period, now)`, `groupByMonth(items)` with month totals, `tripTitle(item)`.
- Components (`components/logbook/`): `LogbookControls` (search + chips), `OptionSheet`, `PeriodSummaryCard`, `RoutesOverviewMap` (+ web stand-in), `TripRow`, `MonthHeader`, `SelectBar`, `FilterSheet`, `TripRowSkeleton`.
- `app/(tabs)/logbook.tsx` rewritten on `StickyHeaderScroll` with a FlatList-style section list.

## Testing

Jest: `periodRange` (week starts Monday, month/year boundaries, all time), `groupByMonth`, `tripTitle`, `logbookStore` (filters reset paging, loadMore appends, deleteSelected partial failure). Backend unit tests as above. Simulator check: period / sort / search / filter change results; routes map draws and opens a trip; select and delete two drives; empty states.

## As built (2026-10-15)

- Select (✓) and Filter buttons sit at the end of the chip row, not in the title row (the title row already holds the Settings gear). In select mode ✓ becomes "Cancel".
- Row chips are 13 pt with 8 pt padding and the day block is 48 pt wide, so km · min · km/h fit on one line as in Rovy.
- Summary values shrink to fit (e.g. "10h 32m").
- `StickyHeaderScroll` gained `onNearEnd` (called while near the end; `loadMore` ignores repeats).
- The list API falls back to `totals = {count: total, …0}` against a server without the new fields, so the page still renders before the production deploy (the summary then shows zero km / time).
