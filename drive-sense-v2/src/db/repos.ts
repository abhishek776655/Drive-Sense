import type {UploadProgress} from '../services/tripUpload';
import type {TripDetail, TripListParams, TripListResult, TripRoutePreview, TripSummary} from '../services/tripService';
import type {FinishedDrive, Sample} from '../stores/recordingStore';
import type {TripMetrics} from '../utils/tripMetrics';
import type {Vehicle} from '../services/vehicleService';
import type {SqlDb, SqlValue} from './sql';

/** A trip as the sync pull sends it: the list summary plus the ids and times the phone needs. */
export type SyncTrip = TripSummary & {vehicle_id: string; updated_at: string};

/** Route lines on the Logbook map are thinned to at most this many points per drive. */
export const ROUTE_POINTS = 120;

// ── vehicles ──────────────────────────────────────────────────────────────────

export const upsertVehicles = (db: SqlDb, vehicles: (Vehicle & {updated_at?: string})[]) => {
  for (const v of vehicles) {
    db.run('INSERT INTO vehicles (id, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at', [
      v.id,
      JSON.stringify(v),
      v.updated_at ?? null,
    ]);
  }
};

export const deleteVehicles = (db: SqlDb, ids: string[]) => {
  for (const id of ids) {
    db.run('DELETE FROM vehicles WHERE id = ?', [id]);
  }
};

/** The server's full list: anything not in it is gone. */
export const replaceVehicles = (db: SqlDb, vehicles: Vehicle[]) => {
  db.transaction(() => {
    db.run('DELETE FROM vehicles');
    upsertVehicles(db, vehicles);
  });
};

export const listVehicles = (db: SqlDb): Vehicle[] =>
  db
    .all<{json: string}>('SELECT json FROM vehicles')
    .map((row) => JSON.parse(row.json) as Vehicle & {created_at?: string})
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));

// ── trips ─────────────────────────────────────────────────────────────────────

const searchText = (t: SyncTrip) => [t.vehicle_name, t.start_address, t.end_address].filter(Boolean).join(' ').toLowerCase();

/**
 * Inserts or refreshes trip summaries. A trip the server changed again (a new `updated_at`) drops
 * its downloaded route so the background download fetches the new one.
 */
export const upsertTrips = (db: SqlDb, trips: SyncTrip[]) => {
  for (const t of trips) {
    const before = db.get<{updated_at: string | null}>('SELECT updated_at FROM trips WHERE id = ?', [t.id]);
    const changed = before != null && before.updated_at !== t.updated_at;
    db.run(
      `INSERT INTO trips (id, vehicle_id, start_time, distance_meters, duration_seconds, driving_score, max_speed_mps, search_text, json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET vehicle_id = excluded.vehicle_id, start_time = excluded.start_time,
         distance_meters = excluded.distance_meters, duration_seconds = excluded.duration_seconds,
         driving_score = excluded.driving_score, max_speed_mps = excluded.max_speed_mps,
         search_text = excluded.search_text, json = excluded.json, updated_at = excluded.updated_at`,
      [t.id, t.vehicle_id, t.start_time, t.distance_meters, t.duration_seconds, t.driving_score, t.max_speed_mps, searchText(t), JSON.stringify(t), t.updated_at],
    );
    if (changed) {
      db.run("UPDATE trips SET points_state = 'none' WHERE id = ?", [t.id]);
      db.run('DELETE FROM trip_details WHERE trip_id = ?', [t.id]);
    }
  }
};

export const deleteTrips = (db: SqlDb, ids: string[]) => {
  for (const id of ids) {
    db.run('DELETE FROM trips WHERE id = ?', [id]);
    db.run('DELETE FROM trip_details WHERE trip_id = ?', [id]);
  }
};

const ORDER: Record<NonNullable<TripListParams['sort']>, string> = {
  newest: 'start_time DESC',
  oldest: 'start_time ASC',
  longest: 'distance_meters DESC, start_time DESC',
  fastest: 'max_speed_mps IS NULL, max_speed_mps DESC, start_time DESC',
  best: 'driving_score IS NULL, driving_score DESC, start_time DESC',
  worst: 'driving_score IS NULL, driving_score ASC, start_time DESC',
};

/** The Logbook's filters as SQL, matching the server's `GET /trips` (spec 2026-10-15, logbook). */
const where = (p: TripListParams, table = ''): {sql: string; params: SqlValue[]} => {
  const col = (name: string) => (table ? `${table}.${name}` : name);
  const clauses: string[] = [];
  const params: SqlValue[] = [];
  if (p.vehicleId) {
    clauses.push(`${col('vehicle_id')} = ?`);
    params.push(p.vehicleId);
  }
  if (p.from) {
    // ISO strings in UTC compare correctly as text.
    clauses.push(`${col('start_time')} >= ?`);
    params.push(new Date(p.from).toISOString());
  }
  if (p.minScore != null) {
    clauses.push(`${col('driving_score')} >= ?`);
    params.push(p.minScore);
  }
  const search = p.search?.trim().toLowerCase();
  if (search) {
    clauses.push(`${col('search_text')} LIKE ? ESCAPE '\\'`);
    params.push(`%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
  }
  return {sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params};
};

/** Vehicle names follow the local vehicles (a rename shows at once, before the trip is re-synced). */
const withVehicleNames = (db: SqlDb, trips: SyncTrip[]): TripSummary[] => {
  const names = new Map(listVehicles(db).map((v) => [v.id, v.display_name]));
  return trips.map((t) => ({...t, vehicle_name: names.get(t.vehicle_id) ?? t.vehicle_name}));
};

export const listTrips = (db: SqlDb, p: TripListParams): TripListResult => {
  const {sql, params} = where(p);
  const totals = db.get<{count: number; distance: number | null; duration: number | null; top: number | null}>(
    `SELECT COUNT(*) AS count, SUM(distance_meters) AS distance, SUM(duration_seconds) AS duration, MAX(max_speed_mps) AS top FROM trips ${sql}`,
    params,
  );
  const rows = db.all<{json: string}>(`SELECT json FROM trips ${sql} ORDER BY ${ORDER[p.sort ?? 'newest']} LIMIT ? OFFSET ?`, [...params, p.limit ?? 20, p.offset ?? 0]);
  const count = totals?.count ?? 0;
  return {
    items: withVehicleNames(
      db,
      rows.map((r) => JSON.parse(r.json) as SyncTrip),
    ),
    total: count,
    totals: {count, distance_meters: totals?.distance ?? 0, duration_seconds: totals?.duration ?? 0, max_speed_mps: totals?.top ?? null},
  };
};

export const tripCount = (db: SqlDb): number => db.get<{n: number}>('SELECT COUNT(*) AS n FROM trips')?.n ?? 0;

/** Newest drives whose route has not been downloaded yet. */
export const tripsMissingRoutes = (db: SqlDb, limit: number): string[] =>
  db.all<{id: string}>("SELECT id FROM trips WHERE points_state = 'none' ORDER BY start_time DESC LIMIT ?", [limit]).map((r) => r.id);

export const markRouteState = (db: SqlDb, tripId: string, state: 'none' | 'ready' | 'failed') => {
  db.run('UPDATE trips SET points_state = ? WHERE id = ?', [state, tripId]);
};

// ── trip details (route points, events, insights) ─────────────────────────────

/** Every n-th point, always keeping the last, so a long drive's line stays light on the map. */
export const thinRoute = (points: TripDetail['location_points'], max = ROUTE_POINTS): [number, number][] => {
  if (points.length <= max) {
    return points.map((p) => [p.latitude, p.longitude]);
  }
  const step = (points.length - 1) / (max - 1);
  return Array.from({length: max}, (_, i) => {
    const p = points[Math.round(i * step)];
    return [p.latitude, p.longitude] as [number, number];
  });
};

export const putDetail = (db: SqlDb, detail: TripDetail, now = new Date()) => {
  db.transaction(() => {
    db.run(
      'INSERT INTO trip_details (trip_id, json, route, fetched_at) VALUES (?, ?, ?, ?) ON CONFLICT(trip_id) DO UPDATE SET json = excluded.json, route = excluded.route, fetched_at = excluded.fetched_at',
      [detail.id, JSON.stringify(detail), JSON.stringify(thinRoute(detail.location_points)), now.toISOString()],
    );
    db.run("UPDATE trips SET points_state = 'ready' WHERE id = ?", [detail.id]);
  });
};

export const getDetail = (db: SqlDb, tripId: string): TripDetail | null => {
  const row = db.get<{json: string}>('SELECT json FROM trip_details WHERE trip_id = ?', [tripId]);
  return row ? (JSON.parse(row.json) as TripDetail) : null;
};

/** Route lines for the Logbook map from downloaded drives, newest first, same filters as the list. */
export const routePreviews = (db: SqlDb, p: Omit<TripListParams, 'offset' | 'sort'>, limit = 30): {routes: TripRoutePreview[]; complete: boolean} => {
  const {sql, params} = where(p, 't');
  const rows = db.all<{json: string; route: string | null}>(
    `SELECT t.json, d.route FROM trips t LEFT JOIN trip_details d ON d.trip_id = t.id ${sql} ORDER BY t.start_time DESC LIMIT ?`,
    [...params, limit],
  );
  const routes = rows
    .filter((r) => r.route)
    .map((r) => {
      const t = JSON.parse(r.json) as SyncTrip;
      return {
        trip_id: t.id,
        start_time: t.start_time,
        distance_meters: t.distance_meters,
        duration_seconds: t.duration_seconds,
        max_speed_mps: t.max_speed_mps,
        start_address: t.start_address,
        end_address: t.end_address,
        points: JSON.parse(r.route as string) as [number, number][],
      };
    });
  // Complete when every matching drive in the window has its route on the phone.
  return {routes, complete: routes.length === rows.length};
};

// ── API answers kept for offline (Home, stats, achievements) ──────────────────

export const cachePut = (db: SqlDb, key: string, value: unknown, now = new Date()) => {
  db.run('INSERT INTO api_cache (key, json, saved_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json, saved_at = excluded.saved_at', [
    key,
    JSON.stringify(value),
    now.toISOString(),
  ]);
};

export const cacheGet = <T,>(db: SqlDb, key: string): T | null => {
  const row = db.get<{json: string}>('SELECT json FROM api_cache WHERE key = ?', [key]);
  return row ? (JSON.parse(row.json) as T) : null;
};

// ── sync bookkeeping ──────────────────────────────────────────────────────────

export const metaGet = (db: SqlDb, key: string): string | null => db.get<{value: string | null}>('SELECT value FROM sync_meta WHERE key = ?', [key])?.value ?? null;

export const metaSet = (db: SqlDb, key: string, value: string | null) => {
  db.run('INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
};

// ── outbox: drives saved on the phone first (local-first part 2a) ─────────────

export interface OutboxItem {
  id: string;
  drive: FinishedDrive;
  samples: Sample[];
  progress: UploadProgress;
  /** The phone's numbers for the whole drive (part 2b); sent with the upload. */
  metrics?: TripMetrics;
}

/** A drive saved on the phone that the server does not have yet. */
export const isLocalTripId = (id: string) => id.startsWith('local:');

/** One id per drive, so saving it twice (a retry, a relaunch) never makes two rows. */
export const outboxId = (drive: Pick<FinishedDrive, 'startedAt'>) => `local:${drive.startedAt}`;

/** Ordered by when the drive started, so drives upload in the order they happened. */
export const outboxPut = (db: SqlDb, item: OutboxItem) => {
  db.run(
    `INSERT INTO outbox (id, drive, samples, progress, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET drive = excluded.drive, samples = excluded.samples, progress = excluded.progress`,
    [item.id, JSON.stringify({...item.drive, metrics: item.metrics}), JSON.stringify(item.samples), JSON.stringify(item.progress), new Date(item.drive.startedAt).toISOString()],
  );
};

export const outboxSetProgress = (db: SqlDb, id: string, progress: UploadProgress) => {
  db.run('UPDATE outbox SET progress = ? WHERE id = ?', [JSON.stringify(progress), id]);
};

export const outboxList = (db: SqlDb): OutboxItem[] =>
  db.all<{id: string; drive: string; samples: string; progress: string}>('SELECT id, drive, samples, progress FROM outbox ORDER BY created_at').map((r) => {
    const {metrics, ...drive} = JSON.parse(r.drive) as FinishedDrive & {metrics?: TripMetrics};
    return {id: r.id, drive, metrics, samples: JSON.parse(r.samples) as Sample[], progress: JSON.parse(r.progress) as UploadProgress};
  });

export const outboxRemove = (db: SqlDb, id: string) => {
  db.run('DELETE FROM outbox WHERE id = ?', [id]);
};

/**
 * The drive as a Logbook row and a trip page right away, from the phone's own numbers, marked
 * pending. The server's version replaces it once uploaded.
 */
export const putLocalTrip = (db: SqlDb, drive: FinishedDrive, metrics?: TripMetrics, points: Sample[] = []) => {
  if (!drive.vehicle) {
    return;
  }
  const id = outboxId(drive);
  const start = new Date(drive.startedAt).toISOString();
  const end = new Date(drive.endedAt).toISOString();
  const summary: SyncTrip = {
    id,
    vehicle_id: drive.vehicle.id,
    vehicle_name: drive.vehicle.name,
    state: 'ended',
    start_time: start,
    end_time: end,
    distance_meters: drive.distanceM,
    duration_seconds: drive.durationSeconds,
    driving_score: metrics?.score ?? drive.score ?? null,
    max_speed_mps: drive.topSpeedMps,
    start_address: null,
    end_address: null,
    event_count: metrics?.events.length ?? drive.eventCount,
    pending: true,
    updated_at: end,
  };
  const detail: TripDetail = {
    id,
    vehicle_id: drive.vehicle.id,
    vehicle_name: drive.vehicle.name,
    start_time: start,
    end_time: end,
    distance_meters: drive.distanceM,
    duration_seconds: drive.durationSeconds,
    avg_speed_mps: drive.avgSpeedMps,
    max_speed_mps: drive.topSpeedMps,
    driving_score: metrics?.score ?? drive.score ?? null,
    idle_time_seconds: metrics?.idleSeconds ?? 0,
    fuel_used_liters: null,
    max_g_force: metrics ? metrics.maxG : drive.maxG,
    max_g_source: metrics ? metrics.maxGSource : drive.maxG != null ? 'sensor' : null,
    left_turns: metrics?.leftTurns ?? null,
    right_turns: metrics?.rightTurns ?? null,
    start_address: null,
    end_address: null,
    // Every recorded fix when the phone kept them (part 2b), else the route line only.
    location_points:
      points.length > 0
        ? points.map((p) => ({
            recorded_at: new Date(p.timestamp).toISOString(),
            latitude: p.latitude,
            longitude: p.longitude,
            speed_mps: p.speedMps,
            altitude_m: p.altitudeM,
            accuracy_m: p.accuracyM,
            peak_g: p.peakG ?? null,
          }))
        : drive.route.map((p) => ({recorded_at: start, latitude: p.latitude, longitude: p.longitude, speed_mps: null, altitude_m: null})),
    events: (metrics?.events ?? []).map((e, i) => ({id: `${id}:${i}`, ...e})),
    insights: [],
  };
  db.transaction(() => {
    upsertTrips(db, [summary]);
    putDetail(db, detail);
  });
};

// ── every fix of the drive in progress (part 2b) ──────────────────────────────

export const appendDrivePoints = (db: SqlDb, startedAt: number, samples: Sample[]) => {
  db.transaction(() => {
    for (const p of samples) {
      db.run('INSERT OR IGNORE INTO drive_points (drive_started_at, ts, json) VALUES (?, ?, ?)', [startedAt, p.timestamp, JSON.stringify(p)]);
    }
  });
};

export const lastDrivePointAt = (db: SqlDb, startedAt: number): number | null =>
  db.get<{ts: number | null}>('SELECT MAX(ts) AS ts FROM drive_points WHERE drive_started_at = ?', [startedAt])?.ts ?? null;

export const drivePoints = (db: SqlDb, startedAt: number): Sample[] =>
  db.all<{json: string}>('SELECT json FROM drive_points WHERE drive_started_at = ? ORDER BY ts', [startedAt]).map((r) => JSON.parse(r.json) as Sample);

export const clearDrivePoints = (db: SqlDb, startedAt: number) => {
  db.run('DELETE FROM drive_points WHERE drive_started_at = ?', [startedAt]);
};
