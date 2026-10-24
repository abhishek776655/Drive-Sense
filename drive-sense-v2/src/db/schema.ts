import type {SqlDb} from './sql';

/**
 * Local database schema, one entry per version (spec 2026-10-17, local-first part 1). Never edit a
 * shipped entry: add the next one. The applied version lives in SQLite's `user_version`.
 */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE vehicles (
    id TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    updated_at TEXT
  );
  CREATE TABLE trips (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    distance_meters REAL NOT NULL,
    duration_seconds INTEGER NOT NULL,
    driving_score INTEGER,
    max_speed_mps REAL,
    search_text TEXT NOT NULL,
    json TEXT NOT NULL,
    updated_at TEXT,
    points_state TEXT NOT NULL DEFAULT 'none'
  );
  CREATE INDEX trips_by_start ON trips (start_time);
  CREATE INDEX trips_by_vehicle ON trips (vehicle_id, start_time);
  CREATE INDEX trips_by_points ON trips (points_state, start_time);
  CREATE TABLE trip_details (
    trip_id TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    route TEXT,
    fetched_at TEXT NOT NULL
  );
  CREATE TABLE api_cache (
    key TEXT PRIMARY KEY,
    json TEXT NOT NULL,
    saved_at TEXT NOT NULL
  );
  CREATE TABLE sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  `,
  // v2 (local-first part 2a): drives saved on the phone first, waiting to upload.
  `
  CREATE TABLE outbox (
    id TEXT PRIMARY KEY,
    drive TEXT NOT NULL,
    samples TEXT NOT NULL,
    progress TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
  // v3 (local-first part 2b): every fix of the drive in progress, so its numbers can be computed
  // from the whole drive when it ends (the upload queue only holds what has not been sent yet).
  `
  CREATE TABLE drive_points (
    drive_started_at INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    json TEXT NOT NULL,
    PRIMARY KEY (drive_started_at, ts)
  );
  `,
  // v4 (local-first part 2c): each stored route's numbers for the stats (altitude, time at speed),
  // and a full pull again so every trip comes back with its idle time and event counts.
  `
  ALTER TABLE trip_details ADD COLUMN point_stats TEXT;
  DELETE FROM sync_meta WHERE key = 'pull_cursor';
  `,
  // v5 (local-first part 3): whether the server has the drive. Drives saved with "This phone only",
  // or left after "Delete cloud data", upload when cloud backup is turned back on.
  `
  ALTER TABLE trips ADD COLUMN in_cloud INTEGER NOT NULL DEFAULT 1;
  UPDATE trips SET in_cloud = 0 WHERE id LIKE 'local:%';
  `,
  // v6 (telemetry): OBD-II seconds of the drive in progress, each finished drive's OBD summary and
  // chart series (keyed by start time: a trip's id changes when it uploads), and paired adapters.
  `
  CREATE TABLE drive_obd_samples (
    drive_started_at INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    json TEXT NOT NULL,
    PRIMARY KEY (drive_started_at, ts)
  );
  CREATE TABLE trip_obd (
    started_at INTEGER PRIMARY KEY,
    stats TEXT NOT NULL,
    series TEXT NOT NULL
  );
  CREATE TABLE obd_adapters (
    vehicle_id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    device_name TEXT NOT NULL,
    vin TEXT,
    supported TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    last_state TEXT
  );
  `,
];

export const TABLES = ['vehicles', 'trips', 'trip_details', 'api_cache', 'sync_meta', 'outbox', 'drive_points', 'drive_obd_samples', 'trip_obd', 'obd_adapters'];

export const schemaVersion = (db: SqlDb): number => db.get<{user_version: number}>('PRAGMA user_version')?.user_version ?? 0;

/** Brings the database up to the latest version, one transaction per step. */
export const migrate = (db: SqlDb) => {
  for (let version = schemaVersion(db); version < MIGRATIONS.length; version++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
};
