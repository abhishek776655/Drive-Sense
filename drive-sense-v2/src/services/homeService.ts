import {isAxiosError} from 'axios';
import {statsFacts} from '../db/repos';
import {homeStats, lastTripOf, trendDays} from '../stats/home';
import {currentProfile, localFirst} from '../stats/source';
import {apiClient} from './apiClient';
import {trendLabel, type TrendGranularity} from '../utils/trend';

/** Shape of `GET /dashboard/home` (spec section 4.2). Every metric is nullable: no data is "–". */
export interface HomeStats {
  top_speed_mps: number | null;
  total_distance_meters: number | null;
  streak_days: number | null;
  /** Unit of `streak_days`: weeks for weekend and occasional drivers (onboarding's frequency). */
  streak_unit?: 'days' | 'weeks';
  /** Drives aimed for this week and done since Monday; null without a goal. */
  week_goal?: {target: number; done: number} | null;
  avg_speed_mps: number | null;
  score: {current: number | null; delta: number | null} | null;
  trip_count: number | null;
  drive_time_seconds: number | null;
  avg_trip_distance_meters: number | null;
  max_g: {value: number; estimated: boolean} | null;
  turns: {left: number; right: number} | null;
  events: {accel: number; brake: number} | null;
  altitude: {highest_m: number; lowest_m: number} | null;
}

export interface LastTrip {
  id: string;
  vehicleName: string;
  startTime: string;
  startAddress: string | null;
  endAddress: string | null;
  distanceMeters: number;
  durationSeconds: number;
  maxSpeedMps: number | null;
}

export {trendLabel, type TrendGranularity} from '../utils/trend';

export interface TrendDay {
  key: string;
  label: string;
  distanceKm: number;
}

interface DashboardTrip {
  trip_id: string;
  vehicle_name: string;
  state: string;
  start_time: string;
  distance_meters: number;
  duration_seconds: number;
  max_speed_mps: number | null;
  start_address: string | null;
  end_address: string | null;
}

interface DashboardResponse {
  summary: {
    total_trips: number;
    total_distance_meters: number;
    total_duration_seconds: number;
    avg_driving_score: number | null;
  };
  events: {harsh_brake_count: number; rapid_acceleration_count: number};
  recent_trips: DashboardTrip[];
}

interface TrendResponse {
  current: {bucket_start: string; distance_meters: number}[];
}

const EMPTY_HOME: HomeStats = {
  top_speed_mps: null,
  total_distance_meters: null,
  streak_days: null,
  avg_speed_mps: null,
  score: null,
  trip_count: null,
  drive_time_seconds: null,
  avg_trip_distance_meters: null,
  max_g: null,
  turns: null,
  events: null,
  altitude: null,
};

/**
 * Until `/dashboard/home` ships, the totals the existing `/dashboard` already knows are filled in
 * and everything else stays null. Nothing is estimated from a partial trip list.
 */
export const homeFromDashboard = (data: DashboardResponse): HomeStats => {
  const {summary} = data;
  const trips = summary.total_trips;
  return {
    ...EMPTY_HOME,
    total_distance_meters: trips > 0 ? summary.total_distance_meters : null,
    trip_count: trips > 0 ? trips : null,
    drive_time_seconds: trips > 0 ? summary.total_duration_seconds : null,
    avg_trip_distance_meters: trips > 0 ? summary.total_distance_meters / trips : null,
    score: summary.avg_driving_score != null ? {current: summary.avg_driving_score, delta: null} : null,
    events:
      trips > 0
        ? {accel: data.events.rapid_acceleration_count, brake: data.events.harsh_brake_count}
        : null,
  };
};

export const lastTripFrom = (data: DashboardResponse): LastTrip | null => {
  const ended = data.recent_trips
    .filter((trip) => trip.state === 'ended')
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  const trip = ended[0];
  if (!trip) {
    return null;
  }
  return {
    id: trip.trip_id,
    vehicleName: trip.vehicle_name,
    startTime: trip.start_time,
    startAddress: trip.start_address,
    endAddress: trip.end_address,
    distanceMeters: trip.distance_meters,
    durationSeconds: trip.duration_seconds,
    maxSpeedMps: trip.max_speed_mps,
  };
};

export const timeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

export const homeService = {
  /** Worked out on the phone once it holds every drive (local-first part 2c), else the server's. */
  getHome: (): Promise<{stats: HomeStats; lastTrip: LastTrip | null}> =>
    localFirst(
      'home',
      (db) => {
        const trips = statsFacts(db);
        const profile = currentProfile(db);
        return {stats: homeStats(trips, {frequency: profile?.driving_frequency, weeklyGoal: profile?.weekly_goal}), lastTrip: lastTripOf(trips)};
      },
      fetchHome,
    ),
  getTrend: (granularity: TrendGranularity = 'day'): Promise<TrendDay[]> =>
    localFirst(`trend:${granularity}`, (db) => trendDays(statsFacts(db), granularity), () => fetchTrend(granularity)),
};

async function fetchHome(): Promise<{stats: HomeStats; lastTrip: LastTrip | null}> {
  const dashboard = await apiClient.get<DashboardResponse>('/api/v1/dashboard');
  let stats: HomeStats;
  try {
    const response = await apiClient.get<HomeStats>('/api/v1/dashboard/home', {params: {tz: timeZone()}});
    stats = {...EMPTY_HOME, ...response.data};
  } catch (error) {
    // The endpoint is new backend work. A 404 means "not deployed yet", not a failure.
    if (isAxiosError(error) && error.response?.status === 404) {
      stats = homeFromDashboard(dashboard.data);
    } else {
      throw error;
    }
  }
  return {stats, lastTrip: lastTripFrom(dashboard.data)};
}

async function fetchTrend(granularity: TrendGranularity): Promise<TrendDay[]> {
  const response = await apiClient.get<TrendResponse>('/api/v1/dashboard/trend', {params: {granularity}});
  return response.data.current.map((point) => ({
    key: point.bucket_start,
    label: trendLabel(point.bucket_start, granularity),
    distanceKm: Math.round(point.distance_meters / 100) / 10,
  }));
}
