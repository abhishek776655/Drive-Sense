import type {TripSensors} from '../tracking/sensors/types';
import type {SqlDb} from './sql';

/** A trip's start time on the server can differ from the phone's by a moment; this much still matches. */
const START_MATCH_MS = 2000;
/** `started_at` is an INTEGER key; drives started from a GPS fix carry fractional milliseconds on iOS. */
const startKey = (startedAt: number) => Math.round(startedAt);

/** A finished drive's phone-sensor summary (cornering, road, phone use), kept on this phone only. */
export const putTripSensors = (db: SqlDb, startedAt: number, value: TripSensors) => {
  db.run('INSERT OR REPLACE INTO trip_sensors (started_at, json) VALUES (?, ?)', [startKey(startedAt), JSON.stringify(value)]);
};

/** The sensor summary of the drive that started at `at` (ms), give or take a couple of seconds. */
export const tripSensors = (db: SqlDb, at: number): TripSensors | null => {
  const startedAt = startKey(at);
  const row = db.get<{json: string}>('SELECT json FROM trip_sensors WHERE started_at BETWEEN ? AND ? ORDER BY ABS(started_at - ?) LIMIT 1', [
    startedAt - START_MATCH_MS,
    startedAt + START_MATCH_MS,
    startedAt,
  ]);
  return row ? (JSON.parse(row.json) as TripSensors) : null;
};

export const deleteTripSensors = (db: SqlDb, at: number) => {
  const startedAt = startKey(at);
  db.run('DELETE FROM trip_sensors WHERE started_at BETWEEN ? AND ?', [startedAt - START_MATCH_MS, startedAt + START_MATCH_MS]);
};
