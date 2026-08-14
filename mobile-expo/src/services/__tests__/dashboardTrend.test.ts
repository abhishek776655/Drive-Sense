import {dashboardService, transformTrendSeries} from '../dashboardService';
import {mockApiGet, mockedApiClient, resetApiClientMocks} from '../../testUtils/mockApiClient';

jest.mock('../apiClient', () => ({
  apiClient: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

const point = (bucketStart: string, distanceKm: number, tripCount = 1) => ({
  bucket_start: bucketStart,
  trip_count: tripCount,
  distance_meters: distanceKm * 1000,
  avg_driving_score: 80,
});

describe('transformTrendSeries', () => {
  it('exposes each bucket in kilometres', () => {
    const view = transformTrendSeries({
      granularity: 'day',
      bucket_count: 2,
      previous: [point('2026-08-11T00:00:00Z', 4), point('2026-08-12T00:00:00Z', 6)],
      current: [point('2026-08-13T00:00:00Z', 10), point('2026-08-14T00:00:00Z', 5)],
    });

    expect(view.previousKm).toEqual([4, 6]);
    expect(view.buckets.map((item) => item.distanceKm)).toEqual([10, 5]);
  });

  it('keeps one decimal so a short errand is not rounded away to zero', () => {
    const view = transformTrendSeries({
      granularity: 'day',
      bucket_count: 1,
      previous: [point('2026-08-13T00:00:00Z', 0, 0)],
      current: [point('2026-08-14T00:00:00Z', 0.42)],
    });

    expect(view.buckets[0].distanceKm).toBe(0.4);
  });

  it('carries the per-bucket trip count and score for the tooltip', () => {
    const view = transformTrendSeries({
      granularity: 'day',
      bucket_count: 1,
      previous: [],
      current: [{...point('2026-08-14T00:00:00Z', 10, 3), avg_driving_score: 87.4}],
    });

    expect(view.buckets[0].tripCount).toBe(3);
    expect(view.buckets[0].score).toBe(87);
  });

  it('leaves the score null when no trip in the bucket was scored', () => {
    const view = transformTrendSeries({
      granularity: 'day',
      bucket_count: 1,
      previous: [],
      current: [{...point('2026-08-14T00:00:00Z', 0, 0), avg_driving_score: null}],
    });

    expect(view.buckets[0].score).toBeNull();
  });

  it('spells the bucket out in the detail label', () => {
    const view = transformTrendSeries({
      granularity: 'week',
      bucket_count: 1,
      previous: [],
      current: [point('2026-08-10T00:00:00Z', 10)],
    });

    expect(view.buckets[0].detailLabel).toContain('Week of');
  });

  it('reports the current window total and trip count', () => {
    const view = transformTrendSeries({
      granularity: 'day',
      bucket_count: 2,
      previous: [point('2026-08-11T00:00:00Z', 4), point('2026-08-12T00:00:00Z', 6)],
      current: [point('2026-08-13T00:00:00Z', 10, 3), point('2026-08-14T00:00:00Z', 5, 1)],
    });

    expect(view.metricValue).toBe('15 km');
    expect(view.metricLabel).toBe('4 trips in the last 2 days');
  });

  it('singularises a one-trip window', () => {
    const view = transformTrendSeries({
      granularity: 'week',
      bucket_count: 1,
      previous: [point('2026-08-03T00:00:00Z', 4, 0)],
      current: [point('2026-08-10T00:00:00Z', 5, 1)],
    });

    expect(view.metricLabel).toBe('1 trip in the last 1 weeks');
  });

  it('computes the delta against the previous window', () => {
    const view = transformTrendSeries({
      granularity: 'day',
      bucket_count: 1,
      previous: [point('2026-08-13T00:00:00Z', 10)],
      current: [point('2026-08-14T00:00:00Z', 15)],
    });

    expect(view.metricDelta).toBe('+50%');
  });

  it('signs a shrinking delta negative', () => {
    const view = transformTrendSeries({
      granularity: 'day',
      bucket_count: 1,
      previous: [point('2026-08-13T00:00:00Z', 10)],
      current: [point('2026-08-14T00:00:00Z', 4)],
    });

    expect(view.metricDelta).toBe('-60%');
  });

  it('suppresses the delta when the previous window drove nothing', () => {
    const view = transformTrendSeries({
      granularity: 'day',
      bucket_count: 1,
      previous: [point('2026-08-13T00:00:00Z', 0, 0)],
      current: [point('2026-08-14T00:00:00Z', 12)],
    });

    expect(view.metricDelta).toBeNull();
  });

  it('labels day buckets by weekday', () => {
    const view = transformTrendSeries({
      granularity: 'day',
      bucket_count: 1,
      previous: [point('2026-08-13T00:00:00Z', 1)],
      current: [point('2026-08-14T00:00:00Z', 1)],
    });

    // 2026-08-14 is a Friday.
    expect(view.buckets.map((item) => item.label)).toEqual(['Fri']);
  });

  it('labels week and month buckets distinguishably', () => {
    // date_trunc always returns a Monday for weeks and the 1st for months, so a weekday formatter
    // would render every bucket identically.
    const weekly = transformTrendSeries({
      granularity: 'week',
      bucket_count: 2,
      previous: [],
      current: [point('2026-08-03T00:00:00Z', 1), point('2026-08-10T00:00:00Z', 1)],
    });
    const monthly = transformTrendSeries({
      granularity: 'month',
      bucket_count: 2,
      previous: [],
      current: [point('2026-07-01T00:00:00Z', 1), point('2026-08-01T00:00:00Z', 1)],
    });

    expect(new Set(weekly.buckets.map((item) => item.label)).size).toBe(2);
    expect(new Set(monthly.buckets.map((item) => item.label)).size).toBe(2);
  });

  it('describes the compared spans in the subtitle', () => {
    const view = transformTrendSeries({
      granularity: 'month',
      bucket_count: 6,
      previous: [],
      current: [],
    });

    expect(view.subtitle).toBe('Last 6 months vs prior 6 months');
  });
});

describe('dashboardService.getDashboard score', () => {
  beforeEach(() => {
    resetApiClientMocks();
  });

  const summary = (avgDrivingScore: number | null) => ({
    total_vehicles: 1,
    total_trips: avgDrivingScore == null ? 0 : 4,
    active_trips: 0,
    total_distance_meters: 0,
    total_duration_seconds: 0,
    total_fuel_used_liters: 0,
    total_fuel_cost_amount: 0,
    avg_driving_score: avgDrivingScore,
  });

  const payload = (avgDrivingScore: number | null) => ({
    summary: summary(avgDrivingScore),
    week_summary: summary(avgDrivingScore),
    today_summary: summary(avgDrivingScore),
    trend: [],
    events: {harsh_brake_count: 0, rapid_acceleration_count: 0, overspeed_count: 0, total_events: 0},
    vehicles: [],
    recent_trips: [],
    recent_events: [],
  });

  it('reports no score at all when nothing has been scored', async () => {
    mockApiGet(payload(null));

    const result = await dashboardService.getDashboard();

    // Not 0: a real 0 means bad driving, and showing it to a new account is a lie.
    expect(result.score).toBeNull();
    expect(result.scoreDelta).toBe(0);
  });

  it('reports a genuine zero score as zero', async () => {
    mockApiGet(payload(0));

    expect((await dashboardService.getDashboard()).score).toBe(0);
  });

  it('rounds a real average score', async () => {
    mockApiGet(payload(87.6));

    expect((await dashboardService.getDashboard()).score).toBe(88);
  });
});

describe('dashboardService.getTrend', () => {
  beforeEach(() => {
    resetApiClientMocks();
  });

  it('requests the selected granularity and returns a chart-ready view', async () => {
    mockApiGet({
      granularity: 'week',
      bucket_count: 1,
      previous: [point('2026-08-03T00:00:00Z', 20)],
      current: [point('2026-08-10T00:00:00Z', 30)],
    });

    const result = await dashboardService.getTrend('week');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/dashboard/trend', {
      params: {granularity: 'week'},
    });
    expect(result.granularity).toBe('week');
    expect(result.buckets.map((item) => item.distanceKm)).toEqual([30]);
    expect(result.metricDelta).toBe('+50%');
  });
});
