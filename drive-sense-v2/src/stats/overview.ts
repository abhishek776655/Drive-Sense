import type {DriveShare, RecordTrip, StatsOverview, StatsPeriod, StatsTrendBucket} from '../services/statsService';
import type {DayRange} from '../utils/calendar';
import {addDays, addMonths, dayKey, dayNumber, midnightOf, mondayOf, monthOf, weekdayOf} from './days';
import {average, maxOf, movingOf, sumOf, type TripFacts} from './facts';
import {bandIndex, secondsOver, SPEED_BAND_LABELS} from './pointStats';
import {bestStreak, dayStreak} from './streaks';

/** Mirrors `stats_overview_service` (spec 2026-10-17, local-first part 2c). */
export const ALL_TIME_MONTHS = 24;
/** A custom range up to this many days gets a bar per day; a longer one, a bar per month. */
export const MAX_DAY_BARS = 62;
export const TOP_PLACES = 5;
export const TOP_DAYS = 3;
export const PARTS_OF_DAY: [string, number, number][] = [
  ['Morning', 5, 12],
  ['Afternoon', 12, 17],
  ['Evening', 17, 21],
  ['Night', 21, 29],
];
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Morning 05–12, afternoon 12–17, evening 17–21, night 21–05. */
export const partOfDay = (hour: number): string => {
  const h = hour >= 5 ? hour : hour + 24;
  return PARTS_OF_DAY.find(([, start, end]) => start <= h && h < end)?.[0] as string;
};

/** First local day of the period: Monday, the 1st, 1 January, or null for all time. */
export const periodStartDay = (period: StatsPeriod, today: string): string | null => {
  if (period === 'week') {
    return mondayOf(today);
  }
  if (period === 'month') {
    return monthOf(today);
  }
  if (period === 'year') {
    return `${today.slice(0, 4)}-01-01`;
  }
  return null;
};

export const customGranularity = (start: string, end: string): 'day' | 'month' => (dayNumber(end) - dayNumber(start) < MAX_DAY_BARS ? 'day' : 'month');

/** `trend_bucket_starts`. */
export const trendBucketStarts = (period: StatsPeriod, today: string, firstDrive: string | null, custom: DayRange | null = null): string[] => {
  const span = (from: string, to: string, step: (k: string) => string) => {
    const out: string[] = [];
    for (let k = from; k <= to; k = step(k)) {
      out.push(k);
    }
    return out;
  };
  const nextMonth = (k: string) => addMonths(k, 1);
  if (period === 'custom' && custom) {
    return customGranularity(custom.start, custom.end) === 'day' ? span(custom.start, custom.end, (k) => addDays(k, 1)) : span(monthOf(custom.start), custom.end, nextMonth);
  }
  if (period === 'week') {
    return span(mondayOf(today), addDays(mondayOf(today), 6), (k) => addDays(k, 1));
  }
  if (period === 'month') {
    return span(monthOf(today), today, (k) => addDays(k, 1));
  }
  if (period === 'year') {
    return span(`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-01`, nextMonth);
  }
  const current = monthOf(today);
  const earliest = addMonths(current, -(ALL_TIME_MONTHS - 1));
  const start = monthOf(firstDrive ?? today);
  return span(start > earliest ? start : earliest, current, nextMonth);
};

export const cityName = (address: string | null): string | null => {
  if (!address) {
    return null;
  }
  const parts = address.split(',');
  return parts[parts.length - 1].trim() || null;
};

/** Plain code-point order, as Python sorts strings (stable between loads, unlike locale order). */
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export const topPlaces = (addresses: (string | null)[], limit = TOP_PLACES) => {
  const counts = new Map<string, number>();
  for (const address of addresses) {
    const name = cityName(address);
    if (name) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || byText(a[0], b[0]))
    .slice(0, limit)
    .map(([name, visits]) => ({name, visits}));
};

const HOUR_LABELS = Array.from({length: 24}, (_, h) => String(h).padStart(2, '0'));

export const driveShares = (trips: TripFacts[]): {timeOfDay: DriveShare[]; weekdays: DriveShare[]; hours: DriveShare[]} => {
  const parts = new Map(PARTS_OF_DAY.map(([label]) => [label, {label, trips: 0, distance_meters: 0}]));
  const days = new Map(WEEKDAYS.map((label) => [label, {label, trips: 0, distance_meters: 0}]));
  const hours = new Map(HOUR_LABELS.map((label) => [label, {label, trips: 0, distance_meters: 0}]));
  for (const t of trips) {
    const start = new Date(t.startMs);
    for (const bucket of [parts.get(partOfDay(start.getHours())), days.get(WEEKDAYS[weekdayOf(dayKey(start))]), hours.get(HOUR_LABELS[start.getHours()])]) {
      bucket!.trips += 1;
      bucket!.distance_meters += t.distance;
    }
  }
  return {timeOfDay: [...parts.values()], weekdays: [...days.values()], hours: [...hours.values()]};
};

export interface OverviewOptions {
  period: StatsPeriod;
  /** Required for, and only used by, `custom`. */
  range?: DayRange | null;
  overKmh?: number;
  now?: Date;
}

/** `get_stats_overview`, over the drives given (all, or one vehicle's). */
export function statsOverview(owned: TripFacts[], {period, range = null, overKmh = 100, now = new Date()}: OverviewOptions): StatsOverview {
  const today = dayKey(now);
  const custom = period === 'custom' && range ? range : null;
  const sinceDay = custom ? custom.start : periodStartDay(period, today);
  const since = sinceDay ? midnightOf(sinceDay).getTime() : null;
  const until = custom ? midnightOf(addDays(custom.end, 1)).getTime() : null;
  const inPeriod = (t: TripFacts) => (since == null || t.startMs >= since) && (until == null || t.startMs < until);
  const scoped = owned.filter(inPeriod);

  const count = scoped.length;
  const distance = sumOf(scoped, (t) => t.distance);
  const duration = sumOf(scoped, (t) => t.duration);
  const idle = sumOf(scoped, (t) => Math.min(t.idle, t.duration));
  const moving = Math.max(duration - idle, 0);
  const first = scoped.reduce<number | null>((min, t) => (min == null || t.startMs < min ? t.startMs : min), null);

  // Trend: one bar per local day (week, month) or month (year, all).
  const granularity = custom ? customGranularity(custom.start, custom.end) : period === 'week' || period === 'month' ? 'day' : 'month';
  const starts = trendBucketStarts(period, today, first != null ? dayKey(first) : null, custom);
  const trendFrom = midnightOf(starts[0]).getTime();
  const groups = new Map<string, TripFacts[]>();
  for (const t of owned) {
    if (t.startMs >= trendFrom && (until == null || t.startMs < until)) {
      const day = dayKey(t.startMs);
      const bucket = granularity === 'day' ? day : monthOf(day);
      groups.set(bucket, [...(groups.get(bucket) ?? []), t]);
    }
  }
  const buckets: StatsTrendBucket[] = starts.map((start) => {
    const rows = groups.get(start) ?? [];
    const dist = sumOf(rows, (t) => t.distance);
    const moved = sumOf(rows, movingOf);
    return {
      start,
      distance_meters: dist,
      duration_seconds: sumOf(rows, (t) => t.duration),
      avg_speed_mps: moved > 0 && dist > 0 ? dist / moved : null,
      max_speed_mps: maxOf(rows.map((t) => t.maxSpeed)),
      max_g: maxOf(rows.map((t) => t.maxG)),
      avg_score: average(rows.map((t) => t.score).filter((s): s is number => s != null)),
    };
  });

  const tripsByBand = SPEED_BAND_LABELS.map(() => 0);
  for (const t of scoped) {
    if (t.maxSpeed != null && t.maxSpeed > 0) {
      tripsByBand[bandIndex(t.maxSpeed * 3.6)] += 1;
    }
  }
  const withPoints = scoped.filter((t) => t.points != null);
  const timeAtSpeed = SPEED_BAND_LABELS.map((label, i) => ({
    label,
    seconds: sumOf(withPoints, (t) => t.points!.bands[i][0]),
    meters: sumOf(withPoints, (t) => t.points!.bands[i][1]),
  }));
  const movingGps = sumOf(timeAtSpeed, (b) => b.seconds);
  const overSeconds = sumOf(withPoints, (t) => secondsOver(t.points!, overKmh));

  const brakes = sumOf(scoped, (t) => t.harshBrakes);
  const launches = sumOf(scoped, (t) => t.rapidAccels);
  const speeding = sumOf(scoped, (t) => t.overspeeds);
  const sharpTurns = sumOf(scoped, (t) => t.sharpTurns);
  const climbing = withPoints.filter((t) => t.points!.climb != null);

  const record = (value: (t: TripFacts) => number | null): RecordTrip | null => {
    let best: TripFacts | null = null;
    for (const t of scoped) {
      const v = value(t);
      if (v != null && v > 0 && (best == null || v > (value(best) as number) || (v === value(best) && t.startMs > best.startMs))) {
        best = t;
      }
    }
    return best ? {trip_id: best.id, value: value(best) as number, start_time: best.startTime, end_address: best.endAddress} : null;
  };

  const perDay = new Map<string, {date: string; distance_meters: number; trip_count: number}>();
  for (const t of scoped) {
    const date = dayKey(t.startMs);
    const day = perDay.get(date) ?? {date, distance_meters: 0, trip_count: 0};
    day.distance_meters += t.distance;
    day.trip_count += 1;
    perDay.set(date, day);
  }
  // Streaks are all-time (for the chosen vehicle): a streak inside "this week" means little.
  const driveDays = owned.map((t) => dayKey(t.startMs));
  const shares = driveShares(scoped);

  return {
    period,
    since: since != null ? new Date(since).toISOString() : null,
    until: until != null ? new Date(until).toISOString() : null,
    summary: {
      distance_meters: distance,
      trip_count: count,
      avg_distance_meters: count ? distance / count : null,
      duration_seconds: duration,
      avg_duration_seconds: count ? duration / count : null,
      avg_speed_mps: moving > 0 && distance > 0 ? distance / moving : null,
      moving_seconds: moving,
      idle_seconds: idle,
      longest_distance_meters: count ? maxOf(scoped.map((t) => t.distance)) : null,
    },
    trend: {granularity, buckets},
    speed_distribution: SPEED_BAND_LABELS.map((label, i) => ({label, trips: tripsByBand[i]})),
    time_at_speed: timeAtSpeed,
    records: {
      top_speed: record((t) => t.maxSpeed),
      longest_distance: record((t) => t.distance),
      longest_duration: record((t) => t.duration),
      best_score: record((t) => t.score),
    },
    top_days: [...perDay.values()].sort((a, b) => b.distance_meters - a.distance_meters || byText(b.date, a.date)).slice(0, TOP_DAYS),
    streaks: {current_days: dayStreak(driveDays, today), best_days: bestStreak(driveDays)},
    places: topPlaces(scoped.map((t) => t.endAddress)),
    events: {
      harsh_brake: brakes,
      rapid_acceleration: launches,
      overspeed: speeding,
      sharp_turn: sharpTurns,
      per_100km: distance > 0 ? (brakes + launches + speeding + sharpTurns) / (distance / 100_000) : null,
    },
    speeding: {limit_kmh: overKmh, seconds: overSeconds, share: movingGps > 0 ? overSeconds / movingGps : null},
    elevation_gain_m: climbing.length ? sumOf(climbing, (t) => t.points!.climb as number) : null,
    time_of_day: shares.timeOfDay,
    weekdays: shares.weekdays,
    hours: shares.hours,
  };
}
