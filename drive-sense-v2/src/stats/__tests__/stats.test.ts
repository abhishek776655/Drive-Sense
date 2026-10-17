import type {TripPoint} from '../../services/tripService';
import {at, fact} from '../../testUtils/statsFacts';
import {homeStats, lastTripOf, trendDays} from '../home';
import {statsOverview} from '../overview';
import {pointStats, secondsOver} from '../pointStats';

const T0 = Date.parse('2026-10-16T03:30:00Z');
/** A point `s` seconds into a drive, at `kmh`. */
const pt = (s: number, kmh: number | null, altitude: number | null = null): TripPoint => ({
  recorded_at: new Date(T0 + s * 1000).toISOString(),
  latitude: 28,
  longitude: 77,
  speed_mps: kmh == null ? null : kmh / 3.6,
  altitude_m: altitude,
});

describe('pointStats', () => {
  it('drives each interval at the earlier point speed, skipping stops, gaps and missing speeds', () => {
    const stats = pointStats([pt(0, 30), pt(10, 50), pt(20, 3), pt(30, 112), pt(700, 112), pt(710, null), pt(720, 90)]);
    // 0–10 s at 30 km/h, 10–20 s at 50, 20–30 s stopped, 30–700 s a gap, 700–710 s at 112, then no speed.
    expect(stats.bands.map(([s]) => s)).toEqual([0, 10, 10, 0, 0, 10]);
    expect(stats.bands[1][1]).toBeCloseTo((30 / 3.6) * 10);
    expect(secondsOver(stats, 100)).toBe(10);
    expect(secondsOver(stats, 111)).toBe(10);
    expect(secondsOver(stats, 115)).toBe(0);
  });

  it('keeps altitude without the 0.0 of a missing fix, and the climb', () => {
    const stats = pointStats([pt(0, 40, 200), pt(5, 40, 0), pt(10, 40, 204), pt(15, 40, 202), pt(20, 40, 210)]);
    expect(stats).toMatchObject({altMax: 210, altMin: 200, climb: 10});
    expect(pointStats([pt(0, 40), pt(5, 40, 0)])).toMatchObject({altMax: null, altMin: null, climb: null});
  });

  it('sorts points by time first', () => {
    expect(pointStats([pt(10, 50), pt(0, 30)]).bands[1][0]).toBe(10);
  });
});

const NOW = at(2026, 10, 16, 18, 30);

describe('homeStats', () => {
  it('is all nulls with no drives', () => {
    const stats = homeStats([], {now: NOW});
    expect(stats).toMatchObject({trip_count: null, total_distance_meters: null, streak_days: null, score: null, events: null, max_g: null, turns: null, altitude: null});
  });

  it('adds up the drives the way the server does', () => {
    const trips = [
      fact(at(2026, 10, 16, 9), {distance: 10_000, duration: 1200, idle: 200, maxSpeed: 25, score: 90, maxG: 0.4, maxGSource: 'gps', leftTurns: 3, rightTurns: 1, rapidAccels: 1, points: {altMax: 250, altMin: 210, climb: 5, bands: [], over: {}}}),
      fact(at(2026, 10, 15, 9), {distance: 5000, duration: 600, idle: 900, maxSpeed: 0, score: 70, maxG: 0.6, maxGSource: 'sensor', harshBrakes: 2, points: {altMax: 230, altMin: 190, climb: 0, bands: [], over: {}}}),
      fact(at(2026, 10, 5, 9), {distance: 5000, duration: 600, maxSpeed: 30, score: 60}),
    ];
    const stats = homeStats(trips, {now: NOW, weeklyGoal: 3});
    expect(stats.trip_count).toBe(3);
    expect(stats.total_distance_meters).toBe(20_000);
    expect(stats.drive_time_seconds).toBe(2400);
    // Moving time is per drive, never below zero: 1000 + 0 + 600.
    expect(stats.avg_speed_mps).toBeCloseTo(20_000 / 1600);
    expect(stats.top_speed_mps).toBe(30);
    // This week 90 and 70; the week before 60.
    expect(stats.score).toEqual({current: 80, delta: 20});
    expect(stats.max_g).toEqual({value: 0.6, estimated: false});
    expect(stats.turns).toEqual({left: 3, right: 1});
    expect(stats.events).toEqual({accel: 1, brake: 2});
    expect(stats.altitude).toEqual({highest_m: 250, lowest_m: 190});
    expect(stats.streak_days).toBe(2);
    expect(stats.streak_unit).toBe('days');
    expect(stats.week_goal).toEqual({target: 3, done: 2});
  });

  it('keeps a week streak for weekend drivers', () => {
    const trips = [fact(at(2026, 10, 11)), fact(at(2026, 10, 4)), fact(at(2026, 9, 27))];
    expect(homeStats(trips, {now: NOW, frequency: 'weekends'})).toMatchObject({streak_days: 3, streak_unit: 'weeks', week_goal: {target: null, done: 0}});
  });

  it('finds the newest drive for the last-drive card', () => {
    const newest = fact(at(2026, 10, 16, 8), {vehicleName: 'City bike'});
    expect(lastTripOf([fact(at(2026, 10, 1)), newest])).toMatchObject({id: newest.id, vehicleName: 'City bike'});
    expect(lastTripOf([])).toBeNull();
  });

  it('fills 14 local days of distance for the trend', () => {
    const days = trendDays([fact(at(2026, 10, 16, 0, 10), {distance: 12_345}), fact(at(2026, 10, 1), {distance: 9999})], 'day', NOW);
    expect(days).toHaveLength(14);
    expect(new Date(days[13].key).getDate()).toBe(16);
    expect(days[13].distanceKm).toBe(12.3);
    expect(days.slice(0, 13).every((d) => d.distanceKm === 0)).toBe(true);
  });
});

describe('statsOverview', () => {
  const trips = [
    fact(at(2026, 10, 16, 9), {
      distance: 20_000,
      duration: 1800,
      idle: 300,
      maxSpeed: 31,
      maxG: 0.5,
      score: 88,
      endAddress: 'Sector 29, Gurugram',
      harshBrakes: 1,
      points: {altMax: 1, altMin: 1, climb: 12, bands: [[0, 0], [0, 0], [600, 6000], [0, 0], [0, 0], [300, 9000]], over: {'104': 300}},
    }),
    fact(at(2026, 10, 14, 22), {distance: 4000, duration: 600, maxSpeed: 12, score: 95, endAddress: 'Dwarka, Delhi'}),
    fact(at(2026, 10, 3, 9), {distance: 8000, duration: 900, maxSpeed: 20, endAddress: 'Delhi'}),
    fact(at(2026, 9, 30, 9), {distance: 1000, vehicleId: 'v2'}),
  ];

  it('summarises one period and keeps streaks all-time', () => {
    const week = statsOverview(trips, {period: 'week', now: NOW, overKmh: 100});
    expect(week.since).toBe(at(2026, 10, 12, 0).toISOString());
    expect(week.summary).toMatchObject({trip_count: 2, distance_meters: 24_000, duration_seconds: 2400, idle_seconds: 300, moving_seconds: 2100, longest_distance_meters: 20_000});
    expect(week.trend.granularity).toBe('day');
    expect(week.trend.buckets).toHaveLength(7);
    expect(week.trend.buckets[4]).toMatchObject({start: '2026-10-16', distance_meters: 20_000, max_speed_mps: 31, max_g: 0.5, avg_score: 88});
    expect(week.trend.buckets[0]).toMatchObject({distance_meters: 0, max_speed_mps: null, avg_score: null});
    expect(week.speed_distribution.map((b) => b.trips)).toEqual([0, 0, 1, 0, 0, 1]);
    expect(week.time_at_speed[5]).toEqual({label: '100+', seconds: 300, meters: 9000});
    expect(week.speeding).toEqual({limit_kmh: 100, seconds: 300, share: 300 / 900});
    expect(week.events).toEqual({harsh_brake: 1, rapid_acceleration: 0, overspeed: 0, per_100km: 1 / 0.24});
    expect(week.elevation_gain_m).toBe(12);
    expect(week.records.best_score).toMatchObject({value: 95, trip_id: trips[1].id});
    expect(week.records.top_speed).toMatchObject({value: 31, end_address: 'Sector 29, Gurugram'});
    expect(week.places).toEqual([
      {name: 'Delhi', visits: 1},
      {name: 'Gurugram', visits: 1},
    ]);
    expect(week.top_days[0]).toEqual({date: '2026-10-16', distance_meters: 20_000, trip_count: 1});
    expect(week.streaks).toEqual({current_days: 1, best_days: 1});
    expect(week.time_of_day.find((p) => p.label === 'Night')?.trips).toBe(1);
  });

  it('narrows to the drives given, and a custom range ends after its last day', () => {
    const custom = statsOverview(trips, {period: 'custom', range: {start: '2026-09-30', end: '2026-10-03'}, now: NOW});
    expect(custom.summary.trip_count).toBe(2);
    expect(custom.until).toBe(at(2026, 10, 4, 0).toISOString());
    expect(custom.trend.buckets.map((b) => b.start)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']);
    const all = statsOverview(trips, {period: 'all', now: NOW});
    expect(all.trend.buckets.map((b) => b.start)).toEqual(['2026-09-01', '2026-10-01']);
    expect(all.speeding?.share).toBe(1 / 3);
  });

  it('has empty numbers, not errors, without drives', () => {
    const empty = statsOverview([], {period: 'month', now: NOW});
    expect(empty.summary).toMatchObject({trip_count: 0, avg_distance_meters: null, avg_speed_mps: null, longest_distance_meters: null});
    expect(empty.speeding?.share).toBeNull();
    expect(empty.events?.per_100km).toBeNull();
    expect(empty.elevation_gain_m).toBeNull();
    expect(empty.trend.buckets).toHaveLength(16);
  });
});
