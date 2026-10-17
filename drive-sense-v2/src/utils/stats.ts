import type {StatsPeriod, StatsTrendBucket} from '../services/statsService';
import {formatDuration, formatInt, formatG} from './format';
import {distanceUnit, formatDistance, formatSpeed, kmhInUnits, speedUnit, type UnitSystem} from './units';

export const STATS_PERIODS: {value: StatsPeriod; label: string; empty: string}[] = [
  {value: 'week', label: 'Week', empty: 'No drives this week'},
  {value: 'month', label: 'Month', empty: 'No drives this month'},
  {value: 'year', label: 'Year', empty: 'No drives this year'},
  {value: 'all', label: 'All', empty: 'No drives yet'},
];

/** What the empty card says for a custom range or picked month. */
export const CUSTOM_EMPTY = 'No drives in these dates';

/** Readout over the trend chart before a bar is tapped: "This week" and so on. */
export const PERIOD_TITLES: Record<Exclude<StatsPeriod, 'custom'>, string> = {week: 'This week', month: 'This month', year: 'This year', all: 'All time'};

export type TrendMetric = 'distance' | 'time' | 'avgSpeed' | 'maxSpeed' | 'maxG' | 'score';

/** Each trend: the bar height (a plain number) and how its value reads in the chosen units. */
export const TREND_METRICS: {
  value: TrendMetric;
  label: string;
  unit: (units: UnitSystem) => string;
  read: (b: StatsTrendBucket) => number | null;
  format: (n: number | null, units: UnitSystem) => string;
}[] = [
  {value: 'distance', label: 'Distance', unit: distanceUnit, read: (b) => b.distance_meters, format: formatDistance},
  {value: 'time', label: 'Drive time', unit: () => '', read: (b) => b.duration_seconds, format: formatDuration},
  {value: 'avgSpeed', label: 'Avg speed', unit: speedUnit, read: (b) => b.avg_speed_mps, format: formatSpeed},
  {value: 'maxSpeed', label: 'Max speed', unit: speedUnit, read: (b) => b.max_speed_mps, format: formatSpeed},
  {value: 'score', label: 'Score', unit: () => '/ 100', read: (b) => b.avg_score ?? null, format: (n) => formatInt(n)},
  {value: 'maxG', label: 'Max G', unit: () => 'G', read: (b) => b.max_g, format: formatG},
];

/** A km/h band label ("20–40", "100+") with its bounds in the chosen unit: "12–25", "62+". */
export const speedBandLabel = (label: string, units: UnitSystem): string =>
  units === 'metric' ? label : label.replace(/\d+/g, (kmh) => String(kmhInUnits(Number(kmh), units)));

/** `YYYY-MM-DD` as a local calendar date (not UTC midnight, which can fall on the day before). */
export const localDate = (iso: string): Date => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Axis label under a trend bar: weekday initial for a week, day of month, or month initial. */
export const trendAxisLabel = (start: string, granularity: 'day' | 'month', period: StatsPeriod): string => {
  const date = localDate(start);
  if (granularity === 'month') {
    return date.toLocaleDateString('en-IN', {month: 'narrow'});
  }
  return period === 'week' ? date.toLocaleDateString('en-IN', {weekday: 'narrow'}) : String(date.getDate());
};

/** Long name of a bar, for the readout above the chart. */
export const trendBucketTitle = (start: string, granularity: 'day' | 'month'): string =>
  localDate(start).toLocaleDateString('en-IN', granularity === 'month' ? {month: 'long', year: 'numeric'} : {weekday: 'short', day: 'numeric', month: 'short'});

/** With many bars only some get a label: every bar up to 12, else about every fifth plus the last. */
export const showAxisLabel = (index: number, count: number): boolean => {
  if (count <= 12) {
    return true;
  }
  const step = Math.ceil(count / 6);
  return index % step === 0 || index === count - 1;
};

/** The whole period's value for a metric: totals for distance and time, the peak for maxima, and
 * distance over moving time for average speed (moving time per bar is distance / its average). */
export const trendTotal = (metric: TrendMetric, buckets: StatsTrendBucket[]): number | null => {
  const peak = (values: (number | null)[]) => {
    const known = values.filter((v): v is number => v != null);
    return known.length ? Math.max(...known) : null;
  };
  switch (metric) {
    case 'distance':
      return buckets.reduce((sum, b) => sum + b.distance_meters, 0);
    case 'time':
      return buckets.reduce((sum, b) => sum + b.duration_seconds, 0);
    case 'avgSpeed': {
      const timed = buckets.filter((b) => b.avg_speed_mps != null && b.avg_speed_mps > 0);
      const meters = timed.reduce((sum, b) => sum + b.distance_meters, 0);
      const seconds = timed.reduce((sum, b) => sum + b.distance_meters / (b.avg_speed_mps as number), 0);
      return seconds > 0 ? meters / seconds : null;
    }
    case 'maxSpeed':
      return peak(buckets.map((b) => b.max_speed_mps));
    case 'score': {
      // Mean of the bars that have drives: a quiet day does not pull the score toward zero.
      const scored = buckets.map((b) => b.avg_score).filter((v): v is number => v != null);
      return scored.length ? scored.reduce((sum, v) => sum + v, 0) / scored.length : null;
    }
    case 'maxG':
      return peak(buckets.map((b) => b.max_g));
  }
};
