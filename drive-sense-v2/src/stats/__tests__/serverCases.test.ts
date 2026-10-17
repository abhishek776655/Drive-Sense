/**
 * The server's own unit tests (`test_home_stats`, `test_stats_overview`, `test_achievements`),
 * replayed against the phone's ports. Times are built in the test machine's zone, which is what
 * the phone's local days use.
 */
import {computeAchievements, achievementsOverview, CATALOG, levelFor} from '../achievements';
import {addDays} from '../days';
import {bandIndex, elevationGain} from '../pointStats';
import {cityName, customGranularity, driveShares, partOfDay, periodStartDay, topPlaces, trendBucketStarts} from '../overview';
import {bestStreak, dayStreak} from '../streaks';
import {at, fact} from '../../testUtils/statsFacts';

const TODAY = '2026-10-11';

describe('home streaks (test_home_stats)', () => {
  it('counts consecutive days ending today', () => {
    expect(dayStreak([TODAY, addDays(TODAY, -1), addDays(TODAY, -2)], TODAY)).toBe(3);
  });
  it('survives until the day after the last drive', () => {
    expect(dayStreak([addDays(TODAY, -1), addDays(TODAY, -2)], TODAY)).toBe(2);
  });
  it('breaks after a missed day', () => {
    expect(dayStreak([addDays(TODAY, -2)], TODAY)).toBe(0);
    expect(dayStreak([TODAY, addDays(TODAY, -2)], TODAY)).toBe(1);
    expect(dayStreak([], TODAY)).toBe(0);
  });
});

// A Friday.
const NOW_DAY = '2026-10-16';

describe('stats overview (test_stats_overview)', () => {
  it('starts periods at local midnight', () => {
    expect(periodStartDay('week', NOW_DAY)).toBe('2026-10-12');
    expect(periodStartDay('month', NOW_DAY)).toBe('2026-10-01');
    expect(periodStartDay('year', NOW_DAY)).toBe('2026-01-01');
    expect(periodStartDay('all', NOW_DAY)).toBeNull();
  });

  it('follows the period with its trend buckets', () => {
    const week = trendBucketStarts('week', NOW_DAY, null);
    expect(week[0]).toBe('2026-10-12');
    expect(week).toHaveLength(7);
    const month = trendBucketStarts('month', NOW_DAY, null);
    expect(month[0]).toBe('2026-10-01');
    expect(month[month.length - 1]).toBe(NOW_DAY);
    expect(trendBucketStarts('year', NOW_DAY, null)).toEqual(Array.from({length: 12}, (_, i) => `2026-${String(i + 1).padStart(2, '0')}-01`));
  });

  it('runs the all-time trend from the first drive, capped at 24 months', () => {
    expect(trendBucketStarts('all', NOW_DAY, '2026-08-20')).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
    const long = trendBucketStarts('all', NOW_DAY, '2019-01-05');
    expect(long).toHaveLength(24);
    expect(long[23]).toBe('2026-10-01');
    expect(long[0]).toBe('2024-11-01');
    expect(trendBucketStarts('all', NOW_DAY, null)).toEqual(['2026-10-01']);
  });

  it('makes speed bands 20 km/h wide with an open top', () => {
    expect([0, 19.9, 20, 99, 180].map(bandIndex)).toEqual([0, 0, 1, 4, 5]);
  });

  it('finds the longest run of days', () => {
    const d = '2026-10-01';
    expect(bestStreak([])).toBe(0);
    expect(bestStreak([d])).toBe(1);
    expect(bestStreak([d, addDays(d, 1), addDays(d, 2), addDays(d, 5), addDays(d, 6)])).toBe(3);
    expect(bestStreak([d, d])).toBe(1);
  });

  it('groups places by city and ranks them by visits', () => {
    expect(cityName('Sector 29, Gurugram')).toBe('Gurugram');
    expect(cityName('  ')).toBeNull();
    expect(cityName(null)).toBeNull();
    const addresses = ['A Road, Gurugram', 'A Road, Gurugram', 'B Road, Gurugram', 'Delhi', 'Delhi', 'Delhi', ...Array(9).fill(null), 'X, Agra'];
    expect(topPlaces(addresses, 2)).toEqual([
      {name: 'Delhi', visits: 3},
      {name: 'Gurugram', visits: 3},
    ]);
  });

  it('gives a custom range a bar per day, then per month', () => {
    expect(trendBucketStarts('custom', NOW_DAY, null, {start: '2026-09-28', end: '2026-10-03'})).toEqual(Array.from({length: 6}, (_, i) => addDays('2026-09-28', i)));
    expect(customGranularity('2026-01-01', '2026-03-03')).toBe('day');
    expect(customGranularity('2026-01-01', '2026-03-04')).toBe('month');
    expect(trendBucketStarts('custom', NOW_DAY, null, {start: '2025-11-15', end: '2026-02-02'})).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01']);
  });

  it('ignores altitude jitter in the climb', () => {
    expect(elevationGain([])).toBe(0);
    expect(elevationGain([200, 201, 199, 200.5])).toBe(0);
    expect(elevationGain([200, 204, 202, 210, 206])).toBe(10);
  });

  it('splits drives by part of day and weekday', () => {
    expect([5, 11, 12, 16, 17, 20, 21, 2].map(partOfDay)).toEqual(['Morning', 'Morning', 'Afternoon', 'Afternoon', 'Evening', 'Evening', 'Night', 'Night']);
    const {timeOfDay, weekdays} = driveShares([fact(at(2026, 10, 16, 9), {distance: 5000}), fact(at(2026, 10, 16, 21, 30), {distance: 2000})]);
    expect(timeOfDay.map((p) => [p.label, p.trips])).toEqual([
      ['Morning', 1],
      ['Afternoon', 0],
      ['Evening', 0],
      ['Night', 1],
    ]);
    expect(weekdays.find((d) => d.label === 'Fri')?.distance_meters).toBe(7000);
    expect(weekdays).toHaveLength(7);
  });
});

/** `drive(day, ...)` from test_achievements: 10:00 local on 1 October plus `day` days. */
const drive = (day: number, {km = 5, minutes = 20, hour = 10, g = null as number | null, score = null as number | null, harsh = 0} = {}) =>
  fact(at(2026, 10, 1 + day, hour), {distance: km * 1000, duration: minutes * 60, maxG: g, score, harshBrakes: harsh});

const byId = (list: ReturnType<typeof computeAchievements>) => Object.fromEntries(list.map((a) => [a.id, a]));

describe('achievements (test_achievements)', () => {
  it('has 38 unique achievements', () => {
    expect(CATALOG).toHaveLength(38);
    expect(new Set(CATALOG.map((a) => a.id)).size).toBe(38);
  });

  it('unlocks distance at the drive that crosses it', () => {
    const drives = [drive(0, {km: 6}), drive(1, {km: 6}), drive(2, {km: 6})];
    const result = byId(computeAchievements(drives));
    expect(result.distance_10.trip_id).toBe(drives[1].id);
    expect(result.distance_10.unlocked_at).toBe(drives[1].startTime);
    expect(result.distance_50.unlocked_at).toBeNull();
    expect(result.distance_50.progress).toBe(18000);
  });

  it('counts local days in a row for streaks', () => {
    const drives = [drive(0), drive(1), drive(2), drive(4)];
    const result = byId(computeAchievements(drives));
    expect(result.streak_3.trip_id).toBe(drives[2].id);
    expect(result.streak_7.progress).toBe(3);
  });

  it('uses the local clock for night drives', () => {
    expect(byId(computeAchievements([drive(0, {hour: 21})])).night_1.unlocked_at).not.toBeNull();
    expect(byId(computeAchievements([drive(0, {hour: 16})])).night_1.unlocked_at).toBeNull();
  });

  it('handles smooth, G-force and clean drives', () => {
    const drives = [...Array.from({length: 10}, (_, i) => drive(i, {score: 92, g: 0.55})), drive(11, {score: 70, harsh: 2})];
    const result = byId(computeAchievements(drives));
    expect(result.smooth_5.trip_id).toBe(drives[4].id);
    expect(result.gforce_05.trip_id).toBe(drives[0].id);
    expect(result.gforce_08.unlocked_at).toBeNull();
    expect(result.clean_10.trip_id).toBe(drives[9].id);
  });

  it('works out levels and titles', () => {
    expect(levelFor(0)).toEqual([1, 'Learner', 0, 100]);
    expect(levelFor(100).slice(0, 2)).toEqual([2, 'Rookie']);
    expect(levelFor(260).slice(0, 2)).toEqual([3, 'Commuter']);
    expect(levelFor(1000).slice(0, 2)).toEqual([6, 'Cruiser']);
  });

  it('sums unlocked XP in the overview', () => {
    const result = achievementsOverview(computeAchievements([drive(0, {km: 12})]));
    // First Drive (25) + First Miles (50).
    expect(result).toMatchObject({xp: 75, unlocked: 2, total: 38, level: 1});
  });

  it('meets the weekly goal, and counts weeks in a row', () => {
    // 1 October 2026 is a Thursday: two drives in each of four weeks in a row, goal 2.
    const drives = [0, 1, 4, 5, 11, 12, 18, 19].map((d) => drive(d));
    const result = byId(computeAchievements(drives, 2));
    expect(result.goal_1.trip_id).toBe(drives[1].id);
    expect(result.goal_4.trip_id).toBe(drives[7].id);
    expect(byId(computeAchievements(drives)).goal_1.unlocked_at).toBeNull();
  });
});
