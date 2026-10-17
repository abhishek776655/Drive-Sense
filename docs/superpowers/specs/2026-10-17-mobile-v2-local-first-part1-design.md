# DriveSense v2: local-first, part 1 (the phone's copy and the data layer)

Date: 2026-10-17. Status: built.

## Where this sits

Local-first storage with optional server sync, in three parts:

1. **The phone's copy (this spec).** A local SQLite database mirrors the server. The server stays
   the source of truth, and screens read the phone first, so the Logbook, trips, vehicles, Home,
   stats and achievements work offline.
2. **Phone-side calculation.** Drives are saved locally first and uploaded afterwards. Score,
   stats and achievements are computed from the local database.
3. **The sync setting.** Cloud backup on (the default) or phone only, with the data-loss warning,
   "Delete cloud data", file backup and import, and an onboarding page offering the choice with a
   short description of each option.

Decided: sync goes to the DriveSense server, the phone does the computing (parts 2 and 3), an
account is always required, sync is on by default, and the phone holds the full history (routes
download in the background on Wi-Fi).

## Backend

- `TimestampMixin.updated_at` has `onupdate=now()`, so every change, including a soft delete,
  moves it forward.
- Migration `20261017_0010_sync_indexes`: `(user_id, updated_at, id)` indexes on trips and vehicles.
- `GET /sync/pull?since=<cursor>&limit=200` (`app/services/sync_service.py`) returns
  `{vehicles, deleted_vehicles, trips, deleted_trips, cursor, has_more}`:
  - Trips are ended trips only, as list summaries plus `vehicle_id` and `updated_at`, ordered by
    `(updated_at, id)`.
  - The cursor is `"<iso>|<uuid>"`. An unreadable cursor means "from the start".
  - Vehicles changed after the cursor ride along with each page.
- Routes reuse `GET /trips/{id}`, which returns points, events and insights.

## Phone

- `src/db/sql.ts` defines the `SqlDb` interface. `sql.native.ts` backs it with expo-sqlite (file
  `drivesense.db`). Web has none and falls back to the API. Tests use
  `src/testUtils/memoryDb.ts` (`node:sqlite`).
- `src/db/schema.ts`: migrations as SQL strings, versioned with `PRAGMA user_version`. Tables:
  `vehicles`, `trips` (summary columns for the Logbook's filters, the JSON, `points_state`),
  `trip_details` (the full detail JSON and a route thinned to 120 points), `api_cache` and
  `sync_meta`.
- `src/db/repos.ts`:
  - The Logbook's list, filters, sort, paging and totals in SQL.
  - Route previews.
  - Vehicles. Names shown come from the local vehicles, so a rename shows at once.
  - A trip whose `updated_at` changes drops its downloaded route so it is fetched again.
- `src/sync/pull.ts`: `pullAll` writes each page in one transaction and moves the cursor only
  after that page is written.
- `src/sync/backfill.ts`: downloads missing routes newest first, one at a time. A 404 deletes the
  trip; any other error pauses the download.
- `src/sync/syncEngine.ts`:
  - When it pulls: at start, coming back to the app (at most once a minute), after a drive is
    stored, and after sign-in.
  - Route downloads run only on Wi-Fi, while signed in and not recording.
  - Any sign-out, including an expired session, wipes the local database.
- `src/sync/syncStore.ts`: `ready` (a first pull has finished) and `version` (bumped when local
  data changed; the Logbook reloads on it).
- Stores:
  - **Logbook:** reads locally once `ready`, falling back to the API before that. Map lines come
    from local routes, topped up from the API while some are missing.
  - **Trip detail:** local first; otherwise fetched and kept.
  - **Vehicles:** the server list is mirrored locally and used offline.
  - **Deletes and vehicle edits:** go to the server, then to the local copy.
- `src/db/offlineCache.ts`: Home, trend, stats and achievements answers are kept. When there is no
  response, or a 502/503/504, the kept answer is returned.

## Verified

- Simulator: a first pull stored 60 trips and 10 vehicles, and all 60 routes downloaded on Wi-Fi.
  With the backend stopped, the Logbook (list, totals, map), a trip's detail and Home all showed
  from the phone.
- Tests: 442 mobile (repositories, filters, pull paging and deletions, cursor safety, route
  download) and 139 backend.

## Part 2c: stats on the phone (built)

- `GET /sync/pull` trips also carry `idle_time_seconds` and per-type event counts. Local migration
  v4 adds `trip_details.point_stats` (altitude, climb, time per speed band, moving seconds by
  km/h) and clears the pull cursor so every trip is pulled again with the new fields.
- `src/stats/`: ports of `home_stats_service`, `stats_overview_service`, `achievement_service` and
  the Home trend, over `statsFacts(db)`. Days are the phone's local days (the Home trend too,
  where the server uses UTC days).
- `localFirst` (`src/stats/source.ts`): the phone answers when `statsComplete` (every trip has its
  numbers and its route); otherwise the server, and the phone's partial answer if the server
  cannot be reached. Before the first sync: the server with its kept answer.
- The profile (`/auth/me`) is kept offline for the weekly goal and streak unit. Routes that failed
  to download are retried after new ones.
- Verified: the server's unit-test cases replayed on the phone; the demo account (60 trips)
  computed on the phone matches the server's Home, every overview period, custom range, vehicle
  stats and achievements, except the order of exact ties.

## Part 3: the drive backup setting (built)

- Preference `driveBackup`: `cloud` (default) or `phone`, on the device. The account, profile and
  vehicles stay on the server either way; only drives are affected.
- Phone only: no live upload (`tripSync` drops its queue; fixes stay in `drive_points`), the drive
  is stored with `putLocalTrip` and kept, addresses come from `expo-location` reverse geocoding,
  the sync engine skips pull/upload/route download, and stats are always local.
- Local migration v5: `trips.in_cloud`. Back to the cloud, `queueForUpload` puts every `in_cloud = 0`
  drive in the outbox (relabelled to its `local:` id) and it uploads through `/finish`.
- Delete cloud data (`POST /sync/delete-drives`, password checked): downloads any missing routes
  first, refuses if some are still missing, hard-deletes the user's trips on the server (no
  tombstones), then marks every local drive `in_cloud = 0`.
- Backup file: JSON (`drivesense-backup`, version 1) of every trip with its detail, shared via the
  share sheet; import (expo-document-picker) skips drives already present (same id or start time).
- Settings: "Drive backup" choice cards with a status line, Back up to file, Import from file, and
  Delete cloud data (phone only, while the server still has drives). Onboarding step 8 "Back up your
  drives" (now 9 steps).
- Verified on the simulator: a phone-only drive stayed on the phone with Apple addresses and no
  server trip; switching back uploaded it via `/finish`; the backup file held all 61 drives.
