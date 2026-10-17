import type {StatsTrendBucket} from '../../services/statsService';
import {localDate, showAxisLabel, speedBandLabel, TREND_METRICS, trendAxisLabel, trendTotal} from '../stats';

const bucket: StatsTrendBucket = {start: '2026-10-12', distance_meters: 12500, duration_seconds: 3900, avg_speed_mps: 10, max_speed_mps: 25, max_g: 0.42, avg_score: 88};

describe('stats utils', () => {
  it('reads dates as local calendar days', () => {
    const d = localDate('2026-10-12');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 12]);
  });

  it('labels bars by weekday, day of month or month', () => {
    expect(trendAxisLabel('2026-10-12', 'day', 'week')).toBe('M');
    expect(trendAxisLabel('2026-10-12', 'day', 'month')).toBe('12');
    expect(trendAxisLabel('2026-10-01', 'month', 'year')).toBe('O');
  });

  it('thins axis labels on long charts but keeps the last', () => {
    expect([0, 1, 2].every((i) => showAxisLabel(i, 7))).toBe(true);
    const shown = Array.from({length: 31}, (_, i) => i).filter((i) => showAxisLabel(i, 31));
    expect(shown.length).toBeLessThanOrEqual(8);
    expect(shown).toContain(30);
  });

  it('formats each metric', () => {
    const value = (m: string, units: 'metric' | 'imperial' = 'metric') => {
      const metric = TREND_METRICS.find((x) => x.value === m)!;
      return `${metric.format(metric.read(bucket), units)} ${metric.unit(units)}`.trim();
    };
    expect(value('distance')).toBe('12.5 km');
    expect(value('time')).toBe('1h 5m');
    expect(value('avgSpeed')).toBe('36 km/h');
    expect(value('maxSpeed')).toBe('90 km/h');
    expect(value('maxG')).toBe('0.42 G');
  });

  it('formats speed and distance metrics in imperial', () => {
    const value = (m: string) => {
      const metric = TREND_METRICS.find((x) => x.value === m)!;
      return `${metric.format(metric.read(bucket), 'imperial')} ${metric.unit('imperial')}`;
    };
    expect(value('distance')).toBe('7.8 mi');
    expect(value('avgSpeed')).toBe('22 mph');
    expect(value('maxSpeed')).toBe('56 mph');
  });

  it('labels km/h speed bands in the chosen unit', () => {
    expect(speedBandLabel('20–40', 'metric')).toBe('20–40');
    expect(speedBandLabel('20–40', 'imperial')).toBe('12–25');
    expect(speedBandLabel('100+', 'imperial')).toBe('62+');
  });

  it('totals the period: sums, peaks, and distance over moving time', () => {
    const empty: StatsTrendBucket = {start: '2026-10-13', distance_meters: 0, duration_seconds: 0, avg_speed_mps: null, max_speed_mps: null, max_g: null, avg_score: null};
    const other: StatsTrendBucket = {...bucket, start: '2026-10-14', distance_meters: 10000, avg_speed_mps: 20, max_speed_mps: 30};
    const buckets = [bucket, empty, other];
    expect(trendTotal('distance', buckets)).toBe(22500);
    expect(trendTotal('maxSpeed', buckets)).toBe(30);
    // 12.5 km in 1250 s and 10 km in 500 s: 22.5 km in 1750 s.
    expect(trendTotal('avgSpeed', buckets)).toBeCloseTo(22500 / 1750);
    expect(trendTotal('maxG', [empty])).toBeNull();
  });

  it('averages the score over bars with drives', () => {
    const quiet: StatsTrendBucket = {...bucket, start: '2026-10-13', avg_score: null};
    expect(trendTotal('score', [bucket, quiet, {...bucket, avg_score: 92}])).toBe(90);
    expect(trendTotal('score', [quiet])).toBeNull();
  });
});
