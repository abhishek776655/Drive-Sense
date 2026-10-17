import type {HomeStats, LastTrip, TrendDay} from '../services/homeService';
import {trendLabel, type TrendGranularity} from '../utils/trend';
import {addDays, addMonths, dayKey, midnightOf, mondayOf, monthOf} from './days';
import {average, maxOf, movingOf, sumOf, type TripFacts} from './facts';
import {dayStreak, weekStreak} from './streaks';

const SCORE_WINDOW_MS = 7 * 86_400_000;
/** Bars on the Home trend per granularity (`TREND_BUCKETS`). */
export const TREND_BUCKETS: Record<TrendGranularity, number> = {day: 14, week: 8, month: 6};

/** `streak_unit`: weekend and occasional drivers keep a week streak. */
export const streakUnit = (frequency: string | null | undefined): 'days' | 'weeks' => (frequency === 'weekends' || frequency === 'rarely' ? 'weeks' : 'days');

export interface HomeOptions {
  now?: Date;
  frequency?: string | null;
  weeklyGoal?: number | null;
}

/** `get_home_stats`, over the drives given (all of them, or one vehicle's for the Garage). */
export function homeStats(trips: TripFacts[], {now = new Date(), frequency, weeklyGoal}: HomeOptions = {}): HomeStats {
  const count = trips.length;
  const distance = sumOf(trips, (t) => t.distance);
  const duration = sumOf(trips, (t) => t.duration);
  const moving = sumOf(trips, movingOf);
  const top = maxOf(trips.map((t) => (t.maxSpeed != null && t.maxSpeed > 0 ? t.maxSpeed : null)));

  const windowStart = now.getTime() - SCORE_WINDOW_MS;
  const previousStart = windowStart - SCORE_WINDOW_MS;
  const scored = trips.filter((t) => t.score != null);
  const current = average(scored.filter((t) => t.startMs >= windowStart).map((t) => t.score as number));
  const previous = average(scored.filter((t) => t.startMs >= previousStart && t.startMs < windowStart).map((t) => t.score as number));

  const hardest = trips.filter((t) => t.maxG != null).reduce<TripFacts | null>((best, t) => (best == null || (t.maxG as number) > (best.maxG as number) ? t : best), null);
  const turned = trips.filter((t) => t.leftTurns != null);
  const highs = maxOf(trips.map((t) => t.points?.altMax ?? null));
  const lows = trips.map((t) => t.points?.altMin ?? null).filter((v): v is number => v != null);

  const starts = trips.map((t) => dayKey(t.startMs));
  const today = dayKey(now);
  const unit = streakUnit(frequency);
  const monday = mondayOf(today);

  return {
    top_speed_mps: top,
    total_distance_meters: count ? distance : null,
    streak_days: count ? (unit === 'weeks' ? weekStreak(starts, today) : dayStreak(starts, today)) : null,
    streak_unit: unit,
    week_goal: weeklyGoal ? {target: weeklyGoal, done: starts.filter((d) => d >= monday && d <= today).length} : null,
    avg_speed_mps: moving > 0 && distance > 0 ? distance / moving : null,
    score: current != null ? {current, delta: previous != null ? current - previous : null} : null,
    trip_count: count || null,
    drive_time_seconds: count ? duration : null,
    avg_trip_distance_meters: count ? distance / count : null,
    max_g: hardest ? {value: hardest.maxG as number, estimated: hardest.maxGSource !== 'sensor'} : null,
    turns: turned.length ? {left: sumOf(turned, (t) => t.leftTurns ?? 0), right: sumOf(turned, (t) => t.rightTurns ?? 0)} : null,
    events: count ? {accel: sumOf(trips, (t) => t.rapidAccels), brake: sumOf(trips, (t) => t.harshBrakes)} : null,
    altitude: highs != null ? {highest_m: highs, lowest_m: Math.min(...lows)} : null,
  };
}

/** The newest drive, for Home's last-drive card. */
export function lastTripOf(trips: TripFacts[]): LastTrip | null {
  const t = trips.reduce<TripFacts | null>((newest, x) => (newest == null || x.startMs > newest.startMs ? x : newest), null);
  return t
    ? {
        id: t.id,
        vehicleName: t.vehicleName,
        startTime: t.startTime,
        startAddress: t.startAddress,
        endAddress: t.endAddress,
        distanceMeters: t.distance,
        durationSeconds: t.duration,
        maxSpeedMps: t.maxSpeed,
      }
    : null;
}

const bucketOf = (day: string, granularity: TrendGranularity) => (granularity === 'day' ? day : granularity === 'week' ? mondayOf(day) : monthOf(day));
const shift = (bucket: string, granularity: TrendGranularity, steps: number) =>
  granularity === 'day' ? addDays(bucket, steps) : granularity === 'week' ? addDays(bucket, steps * 7) : addMonths(bucket, steps);

/**
 * Home's distance trend: the latest `TREND_BUCKETS` local days, weeks or months, ending with the
 * current one (the server's `current` window, but in local days rather than UTC ones).
 */
export function trendDays(trips: TripFacts[], granularity: TrendGranularity = 'day', now = new Date()): TrendDay[] {
  const latest = bucketOf(dayKey(now), granularity);
  const count = TREND_BUCKETS[granularity];
  const meters = new Map<string, number>();
  for (const t of trips) {
    const bucket = bucketOf(dayKey(t.startMs), granularity);
    meters.set(bucket, (meters.get(bucket) ?? 0) + t.distance);
  }
  return Array.from({length: count}, (_, i) => {
    const bucket = shift(latest, granularity, i - (count - 1));
    const key = midnightOf(bucket).toISOString();
    return {key, label: trendLabel(key, granularity), distanceKm: Math.round((meters.get(bucket) ?? 0) / 100) / 10};
  });
}
