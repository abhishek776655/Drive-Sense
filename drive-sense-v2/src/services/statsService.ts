import {statsFacts} from '../db/repos';
import {statsOverview} from '../stats/overview';
import {localFirst} from '../stats/source';
import {apiClient} from './apiClient';
import type {DayRange} from '../utils/calendar';
import {timeZone} from './homeService';

export type StatsPeriod = 'week' | 'month' | 'year' | 'all' | 'custom';

export interface StatsTrendBucket {
  start: string;
  distance_meters: number;
  duration_seconds: number;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  max_g: number | null;
  avg_score: number | null;
}

export interface DriveShare {
  label: string;
  trips: number;
  distance_meters: number;
}

export interface RecordTrip {
  trip_id: string;
  value: number;
  start_time: string;
  end_address: string | null;
}

/** Shape of `GET /stats/overview`. */
export interface StatsOverview {
  period: StatsPeriod;
  since: string | null;
  until: string | null;
  summary: {
    distance_meters: number;
    trip_count: number;
    avg_distance_meters: number | null;
    duration_seconds: number;
    avg_duration_seconds: number | null;
    avg_speed_mps: number | null;
    moving_seconds: number;
    idle_seconds: number;
    longest_distance_meters: number | null;
  };
  trend: {granularity: 'day' | 'month'; buckets: StatsTrendBucket[]};
  speed_distribution: {label: string; trips: number}[];
  time_at_speed: {label: string; seconds: number; meters: number}[];
  records: {
    top_speed: RecordTrip | null;
    longest_distance: RecordTrip | null;
    longest_duration: RecordTrip | null;
    best_score: RecordTrip | null;
  };
  top_days: {date: string; distance_meters: number; trip_count: number}[];
  streaks: {current_days: number; best_days: number};
  places: {name: string; visits: number}[];
  events: {harsh_brake: number; rapid_acceleration: number; overspeed: number; per_100km: number | null} | null;
  /** Moving time above `limit_kmh` and its share of moving time. */
  speeding: {limit_kmh: number; seconds: number; share: number | null} | null;
  elevation_gain_m: number | null;
  time_of_day: DriveShare[];
  weekdays: DriveShare[];
}

export const statsService = {
  /** `range` is used (and needed) only by the `custom` period. */
  /** `overKmh` is the speeding limit for the time-over figure (the Settings speed alert). */
  /** Worked out on the phone once it holds every drive (local-first part 2c), else the server's. */
  overview: async ({period, vehicleId, range, overKmh}: {period: StatsPeriod; vehicleId: string | null; range?: DayRange | null; overKmh?: number}): Promise<StatsOverview> => {
    const params = {
      period,
      tz: timeZone(),
      ...(overKmh ? {over_kmh: overKmh} : {}),
      ...(vehicleId ? {vehicle_id: vehicleId} : {}),
      ...(period === 'custom' && range ? {start: range.start, end: range.end} : {}),
    };
    return localFirst(
      `stats:${JSON.stringify(params)}`,
      (db) => statsOverview(statsFacts(db, vehicleId), {period, range, overKmh}),
      async () => (await apiClient.get<StatsOverview>('/api/v1/stats/overview', {params})).data,
    );
  },
};
