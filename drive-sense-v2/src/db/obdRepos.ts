import type {PidKey} from '../obd/pids';
import type {ObdRow, ObdSampleRow, ObdSeries, ObdStats} from '../obd/series';
import type {SqlDb} from './sql';

/** A trip's start time on the server can differ from the phone's by a moment; this much still matches. */
const START_MATCH_MS = 2000;

// ── seconds of the drive in progress ──────────────────────────────────────────

export const appendObdSamples = (db: SqlDb, startedAt: number, rows: ObdSampleRow[]) => {
  db.transaction(() => {
    for (const {ts, row} of rows) {
      db.run('INSERT OR REPLACE INTO drive_obd_samples (drive_started_at, ts, json) VALUES (?, ?, ?)', [startedAt, ts, JSON.stringify(row)]);
    }
  });
};

export const obdSamples = (db: SqlDb, startedAt: number): ObdSampleRow[] =>
  db
    .all<{ts: number; json: string}>('SELECT ts, json FROM drive_obd_samples WHERE drive_started_at = ? ORDER BY ts', [startedAt])
    .map((r) => ({ts: r.ts, row: JSON.parse(r.json) as ObdRow}));

export const clearObdSamples = (db: SqlDb, startedAt: number) => {
  db.run('DELETE FROM drive_obd_samples WHERE drive_started_at = ?', [startedAt]);
};

// ── finished drives ──────────────────────────────────────────────────────────

export interface TripObd {
  stats: ObdStats;
  series: ObdSeries;
}

export const putTripObd = (db: SqlDb, startedAt: number, value: TripObd) => {
  db.run('INSERT OR REPLACE INTO trip_obd (started_at, stats, series) VALUES (?, ?, ?)', [startedAt, JSON.stringify(value.stats), JSON.stringify(value.series)]);
};

/** The OBD data of the drive that started at `startedAt` (ms), give or take a couple of seconds. */
export const tripObd = (db: SqlDb, startedAt: number): TripObd | null => {
  const row = db.get<{stats: string; series: string}>(
    'SELECT stats, series FROM trip_obd WHERE started_at BETWEEN ? AND ? ORDER BY ABS(started_at - ?) LIMIT 1',
    [startedAt - START_MATCH_MS, startedAt + START_MATCH_MS, startedAt],
  );
  return row ? {stats: JSON.parse(row.stats) as ObdStats, series: JSON.parse(row.series) as ObdSeries} : null;
};

export const deleteTripObd = (db: SqlDb, startedAt: number) => {
  db.run('DELETE FROM trip_obd WHERE started_at BETWEEN ? AND ?', [startedAt - START_MATCH_MS, startedAt + START_MATCH_MS]);
};

// ── paired adapters (this phone only) ─────────────────────────────────────────

export interface AdapterState {
  mil: boolean;
  codeCount: number;
  fuelLevel: number | null;
  voltage: number | null;
  readAt: string;
}

export interface ObdAdapter {
  vehicleId: string;
  deviceId: string;
  deviceName: string;
  vin: string | null;
  supported: PidKey[];
  lastSeen: string;
  lastState: AdapterState | null;
}

type AdapterRow = {
  vehicle_id: string;
  device_id: string;
  device_name: string;
  vin: string | null;
  supported: string;
  last_seen: string;
  last_state: string | null;
};

const toAdapter = (r: AdapterRow): ObdAdapter => ({
  vehicleId: r.vehicle_id,
  deviceId: r.device_id,
  deviceName: r.device_name,
  vin: r.vin,
  supported: JSON.parse(r.supported) as PidKey[],
  lastSeen: r.last_seen,
  lastState: r.last_state ? (JSON.parse(r.last_state) as AdapterState) : null,
});

export const getAdapter = (db: SqlDb, vehicleId: string): ObdAdapter | null => {
  const row = db.get<AdapterRow>('SELECT * FROM obd_adapters WHERE vehicle_id = ?', [vehicleId]);
  return row ? toAdapter(row) : null;
};

export const listAdapters = (db: SqlDb): ObdAdapter[] => db.all<AdapterRow>('SELECT * FROM obd_adapters').map(toAdapter);

/** One adapter per vehicle, and one vehicle per adapter: pairing it to a car unpairs it elsewhere. */
export const putAdapter = (db: SqlDb, a: ObdAdapter) => {
  db.transaction(() => {
    db.run('DELETE FROM obd_adapters WHERE device_id = ? AND vehicle_id <> ?', [a.deviceId, a.vehicleId]);
    db.run(
      `INSERT OR REPLACE INTO obd_adapters (vehicle_id, device_id, device_name, vin, supported, last_seen, last_state) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [a.vehicleId, a.deviceId, a.deviceName, a.vin, JSON.stringify(a.supported), a.lastSeen, a.lastState ? JSON.stringify(a.lastState) : null],
    );
  });
};

export const deleteAdapter = (db: SqlDb, vehicleId: string) => {
  db.run('DELETE FROM obd_adapters WHERE vehicle_id = ?', [vehicleId]);
};
