import type {StatsOverview} from '../../services/statsService';
import {EMPTY_STATS, useRecordingStore, type RecordingState} from '../../stores/recordingStore';
import {activityTime, driveActivityProps, savedActivityProps, shouldPush, weekWidgetProps} from '../props';

const NOW = new Date('2026-10-15T12:00:00').getTime(); // a Thursday

const drive = (patch: Partial<RecordingState> = {}): RecordingState => ({
  ...useRecordingStore.getState(),
  status: 'recording',
  startedAt: NOW - 23 * 60_000,
  pausedMs: 0,
  pausedAt: null,
  stats: {...EMPTY_STATS, distanceM: 12_400, movingSeconds: 1000},
  ...patch,
});

describe('Live Activity props', () => {
  it('formats time in minutes, then hours', () => {
    expect(activityTime(59)).toBe('0 min');
    expect(activityTime(23 * 60 + 40)).toBe('23 min');
    expect(activityTime(65 * 60)).toBe('1 h 05');
  });

  it('shows a recording drive in the chosen units', () => {
    expect(driveActivityProps(drive(), 'metric', NOW)).toEqual({
      state: 'recording',
      time: '23 min',
      distance: '12.4 km',
      avgSpeed: '45 km/h',
      score: '100',
      events: '',
    });
    expect(driveActivityProps(drive(), 'imperial', NOW)).toMatchObject({distance: '7.7 mi', avgSpeed: '28 mph'});
  });

  it('reads paused, and dashes what is not known yet', () => {
    const fresh = drive({status: 'paused', startedAt: NOW, pausedAt: NOW, stats: EMPTY_STATS});
    expect(driveActivityProps(fresh, 'metric', NOW)).toMatchObject({state: 'paused', avgSpeed: '–', score: '–'});
  });

  it('turns the last live state into the saved card', () => {
    const last = drive({stats: {...EMPTY_STATS, distanceM: 12_400, movingSeconds: 1000, eventCount: 2, brakeCount: 2}});
    expect(savedActivityProps(last, 'metric', NOW)).toMatchObject({state: 'saved', distance: '12.4 km', events: '2 events'});
    expect(savedActivityProps(drive({stats: {...EMPTY_STATS, eventCount: 1}}), 'metric', NOW).events).toBe('1 event');
  });

  it('pushes state changes at once and number changes at most every 5 s', () => {
    const a = driveActivityProps(drive(), 'metric', NOW);
    const b = {...a, distance: '12.5 km'};
    expect(shouldPush(null, a, 0, NOW)).toBe(true);
    expect(shouldPush(a, a, 0, NOW)).toBe(false);
    expect(shouldPush(a, b, NOW - 1000, NOW)).toBe(false);
    expect(shouldPush(a, b, NOW - 5000, NOW)).toBe(true);
    expect(shouldPush(a, {...a, state: 'paused'}, NOW - 10, NOW)).toBe(true);
  });
});

describe('week widget props', () => {
  const bucket = (distance: number, score: number | null) => ({
    start: '',
    distance_meters: distance,
    duration_seconds: 0,
    avg_speed_mps: null,
    max_speed_mps: null,
    max_g: null,
    avg_score: score,
  });
  const overview = {
    summary: {distance_meters: 84_300, trip_count: 6},
    trend: {granularity: 'day', buckets: [bucket(10_000, 90), bucket(0, null), bucket(40_000, 86), bucket(20_000, 88), bucket(0, null), bucket(0, null), bucket(0, null)]},
  } as unknown as StatsOverview;
  const lastTrip = {
    id: 't1',
    vehicleName: 'Swift',
    startTime: new Date(NOW - 2 * 3600_000).toISOString(),
    startAddress: 'Office, Sector 5, Delhi',
    endAddress: 'Home, Dwarka',
    distanceMeters: 12_400,
    durationSeconds: 23 * 60,
    maxSpeedMps: null,
  };

  it('summarises the week with bars scaled to the longest day', () => {
    expect(weekWidgetProps(overview, lastTrip, 'metric', NOW)).toEqual({
      signedIn: true,
      distance: '84.3',
      unit: 'km',
      drives: '6 drives',
      score: '88',
      bars: [0.25, 0, 1, 0.5, 0, 0, 0],
      today: 3,
      last: {route: 'Office → Home', detail: '12.4 km · 23 min · 2 h ago'},
    });
  });

  it('copes with an empty week and no last drive', () => {
    const empty = {summary: {distance_meters: 0, trip_count: 1}, trend: {granularity: 'day', buckets: []}} as unknown as StatsOverview;
    expect(weekWidgetProps(empty, null, 'imperial', NOW)).toMatchObject({drives: '1 drive', score: '–', bars: [0, 0, 0, 0, 0, 0, 0], unit: 'mi', last: null});
  });

  it('falls back to the vehicle name when the trip has no addresses', () => {
    const bare = {...lastTrip, startAddress: null, endAddress: null};
    expect(weekWidgetProps(overview, bare, 'metric', NOW).last?.route).toBe('Swift');
  });
});
