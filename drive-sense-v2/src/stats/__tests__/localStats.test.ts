import {setDbForTests} from '../../db';
import {cachePut, markRouteState, metaGet, metaSet, putDetail, putLocalTrip, statsComplete, statsFacts, tripsMissingRoutes, upsertTrips, type SyncTrip} from '../../db/repos';
import {MIGRATIONS, migrate} from '../../db/schema';
import type {SqlDb} from '../../db/sql';
import type {TripDetail} from '../../services/tripService';
import type {FinishedDrive} from '../../stores/recordingStore';
import {useProfileStore} from '../../stores/profileStore';
import {CURSOR_KEY} from '../../sync/pull';
import {useSyncStore} from '../../sync/syncStore';
import {memoryDb} from '../../testUtils/memoryDb';
import type {TripMetrics} from '../../utils/tripMetrics';
import {currentProfile, localFirst} from '../source';

const trip = (id: string, patch: Partial<SyncTrip> = {}): SyncTrip => ({
  id,
  vehicle_id: 'v1',
  vehicle_name: 'Octavia',
  state: 'ended',
  start_time: '2026-10-10T08:00:00.000Z',
  end_time: '2026-10-10T08:30:00.000Z',
  distance_meters: 10_000,
  duration_seconds: 1800,
  driving_score: 80,
  max_speed_mps: 20,
  start_address: null,
  end_address: 'Home, Dwarka',
  event_count: 1,
  updated_at: '2026-10-10T09:00:00.000Z',
  idle_time_seconds: 120,
  harsh_brake_count: 1,
  rapid_acceleration_count: 0,
  overspeed_count: 0,
  max_g_force: 0.3,
  max_g_source: 'gps',
  left_turns: 2,
  right_turns: 1,
  ...patch,
});

const detail = (id: string): TripDetail =>
  ({
    id,
    location_points: [
      {recorded_at: '2026-10-10T08:00:00.000Z', latitude: 28, longitude: 77, speed_mps: 20, altitude_m: 210},
      {recorded_at: '2026-10-10T08:00:10.000Z', latitude: 28.001, longitude: 77, speed_mps: 20, altitude_m: 215},
    ],
  }) as TripDetail;

const setup = () => {
  const db = memoryDb();
  migrate(db);
  return db;
};

const offline = Object.assign(new Error('Network Error'), {isAxiosError: true, response: undefined});

describe('stats facts on the phone', () => {
  it('reads every trip with its route numbers, for all vehicles or one', () => {
    const db = setup();
    upsertTrips(db, [trip('a'), trip('b', {vehicle_id: 'v2', idle_time_seconds: undefined})]);
    putDetail(db, detail('a'));
    const [a] = statsFacts(db, 'v1');
    expect(a).toMatchObject({id: 'a', idle: 120, harshBrakes: 1, maxG: 0.3, leftTurns: 2, endAddress: 'Home, Dwarka'});
    expect(a.points).toMatchObject({altMax: 215, altMin: 210, climb: 5});
    expect(a.points?.bands[3][0]).toBe(10);
    expect(statsFacts(db)).toHaveLength(2);
    expect(statsFacts(db, 'v2')[0]).toMatchObject({idle: 0, points: null});
  });

  it('is complete only once every trip has its numbers and its route', () => {
    const db = setup();
    expect(statsComplete(db)).toBe(true);
    upsertTrips(db, [trip('a')]);
    expect(statsComplete(db)).toBe(false);
    putDetail(db, detail('a'));
    expect(statsComplete(db)).toBe(true);
    // Synced before part 2c: no idle time yet, until the full pull brings it.
    upsertTrips(db, [trip('b', {idle_time_seconds: undefined})]);
    putDetail(db, detail('b'));
    expect(statsComplete(db)).toBe(false);
  });

  it('works out route numbers for routes stored before part 2c', () => {
    const db = setup();
    upsertTrips(db, [trip('a')]);
    putDetail(db, detail('a'));
    db.run('UPDATE trip_details SET point_stats = NULL');
    expect(statsFacts(db)[0].points?.altMax).toBe(215);
    expect(db.get<{n: number}>('SELECT COUNT(*) AS n FROM trip_details WHERE point_stats IS NULL')?.n).toBe(0);
  });

  it('pulls everything again when upgrading to version 4', () => {
    const db = memoryDb();
    for (let v = 0; v < 3; v++) {
      db.exec(MIGRATIONS[v]);
    }
    db.exec('PRAGMA user_version = 3');
    metaSet(db, CURSOR_KEY, '2026-10-10T09:00:00+00:00|abc');
    metaSet(db, 'last_pull_at', '2026-10-10T09:00:00Z');
    migrate(db);
    expect(metaGet(db, CURSOR_KEY)).toBeNull();
    // The Logbook keeps reading the phone meanwhile.
    expect(metaGet(db, 'last_pull_at')).not.toBeNull();
  });

  it('tries failed routes again, after the new ones', () => {
    const db = setup();
    upsertTrips(db, [trip('old', {start_time: '2026-10-01T08:00:00.000Z'}), trip('new')]);
    markRouteState(db, 'new', 'failed');
    expect(tripsMissingRoutes(db, 10)).toEqual(['old', 'new']);
  });

  it('gives a drive saved on the phone the numbers its stats need', () => {
    const db = setup();
    const startedAt = Date.UTC(2026, 9, 17, 8);
    const drive = {vehicle: {id: 'v1', name: 'Octavia'}, startedAt, endedAt: startedAt + 600_000, durationSeconds: 600, distanceM: 4000, topSpeedMps: 20, avgSpeedMps: 7, eventCount: 2, score: 90, maxG: null, route: []} as unknown as FinishedDrive;
    const metrics: TripMetrics = {
      events: [
        {event_type: 'harsh_brake', intensity: 4, occurred_at: '', latitude: 0, longitude: 0},
        {event_type: 'overspeed', intensity: 1, occurred_at: '', latitude: 0, longitude: 0},
      ],
      score: 88,
      leftTurns: 1,
      rightTurns: 0,
      maxG: 0.35,
      maxGSource: 'gps',
      idleSeconds: 40,
    };
    putLocalTrip(db, drive, metrics);
    expect(statsComplete(db)).toBe(true);
    expect(statsFacts(db)[0]).toMatchObject({idle: 40, harshBrakes: 1, rapidAccels: 0, overspeeds: 1, maxG: 0.35, leftTurns: 1, score: 88});
  });
});

describe('localFirst', () => {
  let db: SqlDb;
  beforeEach(() => {
    db = setup();
    setDbForTests(db);
    useSyncStore.setState({ready: true});
  });
  afterEach(() => {
    setDbForTests(null);
    useSyncStore.setState({ready: false});
    useProfileStore.setState({profile: null});
  });

  it('answers from the phone once it holds everything, without asking the server', async () => {
    const remote = jest.fn();
    await expect(localFirst('k', () => 'phone', remote)).resolves.toBe('phone');
    expect(remote).not.toHaveBeenCalled();
  });

  it('asks the server while routes are missing, and falls back to the phone offline', async () => {
    upsertTrips(db, [trip('a')]);
    await expect(localFirst('k', () => 'phone', async () => 'server')).resolves.toBe('server');
    await expect(
      localFirst(
        'k',
        () => 'phone',
        () => Promise.reject(offline),
      ),
    ).resolves.toBe('phone');
    const denied = Object.assign(new Error('401'), {isAxiosError: true, response: {status: 401}});
    await expect(
      localFirst(
        'k',
        () => 'phone',
        () => Promise.reject(denied),
      ),
    ).rejects.toBe(denied);
  });

  it('uses the server and its kept answer before the first sync', async () => {
    useSyncStore.setState({ready: false});
    await expect(localFirst('k', () => 'phone', async () => 'server')).resolves.toBe('server');
    await expect(
      localFirst(
        'k',
        () => 'phone',
        () => Promise.reject(offline),
      ),
    ).resolves.toBe('server');
  });

  it('reads the goal from the kept profile when it has not loaded', () => {
    cachePut(db, 'profile', {handle: 'abhi', weekly_goal: 4});
    expect(currentProfile(db)?.weekly_goal).toBe(4);
  });
});
