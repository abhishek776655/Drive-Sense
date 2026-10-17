import {setDbForTests} from '../../db';
import {
  backupSnapshot,
  getDetail,
  isInCloud,
  listTrips,
  localOnlyTrips,
  outboxList,
  parseBackup,
  putDetail,
  putLocalTrip,
  queueForUpload,
  restoreBackup,
  setTripAddresses,
  setTripVehicle,
  upsertTrips,
  type SyncTrip,
} from '../../db/repos';
import {MIGRATIONS, migrate} from '../../db/schema';
import type {SqlDb} from '../../db/sql';
import {tripDetailApi, type TripDetail} from '../../services/tripService';
import {usePreferencesStore} from '../../stores/preferencesStore';
import type {FinishedDrive} from '../../stores/recordingStore';
import {memoryDb} from '../../testUtils/memoryDb';
import {addressFrom, CloudDeleteBlocked, deleteCloudDrives, setDriveBackup} from '../driveBackup';

jest.mock('expo-location', () => ({reverseGeocodeAsync: jest.fn()}));
jest.mock('../../services/tripService', () => ({tripDetailApi: {get: jest.fn()}, tripUploadApi: {}}));

const START = '2026-10-10T08:00:00.000Z';

const trip = (id: string, patch: Partial<SyncTrip> = {}): SyncTrip => ({
  id,
  vehicle_id: 'v1',
  vehicle_name: 'Octavia',
  state: 'ended',
  start_time: START,
  end_time: '2026-10-10T08:20:00.000Z',
  distance_meters: 9000,
  duration_seconds: 1200,
  driving_score: 92,
  max_speed_mps: 22,
  start_address: null,
  end_address: 'Home, Dwarka',
  event_count: 1,
  updated_at: '2026-10-10T09:00:00.000Z',
  idle_time_seconds: 60,
  left_turns: 3,
  right_turns: 2,
  max_g_force: 0.4,
  max_g_source: 'gps',
  ...patch,
});

const detail = (id: string): TripDetail =>
  ({
    id,
    avg_speed_mps: 7.5,
    location_points: [
      {recorded_at: START, latitude: 28.6, longitude: 77.2, speed_mps: 10, altitude_m: 200},
      {recorded_at: '2026-10-10T08:00:05.000Z', latitude: 28.601, longitude: 77.2, speed_mps: 12, altitude_m: 201, accuracy_m: 4},
    ],
    events: [
      {id: 'e1', event_type: 'harsh_brake', intensity: 4.2, occurred_at: '2026-10-10T08:00:05.000Z', latitude: 28.601, longitude: 77.2},
      {id: 'e2', event_type: 'stop', intensity: null, occurred_at: START, latitude: null, longitude: null},
    ],
    insights: [],
  }) as unknown as TripDetail;

const setup = () => {
  const db = memoryDb();
  migrate(db);
  return db;
};

describe('phone-only drives', () => {
  it('knows which drives the server has', () => {
    const db = setup();
    upsertTrips(db, [trip('server-1')]);
    putLocalTrip(db, {vehicle: {id: 'v1', name: 'Octavia'}, startedAt: Date.parse(START), endedAt: Date.parse(START) + 60_000, durationSeconds: 60, distanceM: 500, topSpeedMps: 10, avgSpeedMps: 8, eventCount: 0, maxG: null, route: []} as unknown as FinishedDrive);
    expect(isInCloud(db, 'server-1')).toBe(true);
    expect(localOnlyTrips(db)).toEqual([`local:${Date.parse(START)}`]);
  });

  it('marks drives saved before version 5 that never uploaded', () => {
    const db = memoryDb();
    for (let v = 0; v < 4; v++) {
      db.exec(MIGRATIONS[v]);
    }
    db.exec('PRAGMA user_version = 4');
    db.run("INSERT INTO trips (id, vehicle_id, start_time, distance_meters, duration_seconds, search_text, json) VALUES ('local:1', 'v1', ?, 0, 0, '', '{}'), ('abc', 'v1', ?, 0, 0, '', '{}')", [START, START]);
    migrate(db);
    expect(localOnlyTrips(db)).toEqual(['local:1']);
  });

  it('queues a drive left after "Delete cloud data" to upload with its points and numbers, under its local id', () => {
    const db = setup();
    upsertTrips(db, [trip('server-1')]);
    putDetail(db, detail('server-1'));
    db.run('UPDATE trips SET in_cloud = 0');
    const id = queueForUpload(db, 'server-1');
    const localId = `local:${Date.parse(START)}`;
    expect(id).toBe(localId);
    const [item] = outboxList(db);
    expect(item.id).toBe(localId);
    expect(item.drive).toMatchObject({startedAt: Date.parse(START), durationSeconds: 1200, distanceM: 9000, avgSpeedMps: 7.5, tripId: null});
    expect(item.samples).toHaveLength(2);
    expect(item.samples[1]).toMatchObject({speedMps: 12, accuracyM: 4, timestamp: Date.parse('2026-10-10T08:00:05.000Z')});
    // Only the kinds the server scores, each with a place.
    expect(item.metrics?.events).toEqual([{event_type: 'harsh_brake', intensity: 4.2, occurred_at: '2026-10-10T08:00:05.000Z', latitude: 28.601, longitude: 77.2}]);
    expect(item.metrics).toMatchObject({score: 92, leftTurns: 3, rightTurns: 2, idleSeconds: 60, maxG: 0.4});
    expect(listTrips(db, {}).items.map((t) => t.id)).toEqual([localId]);
    expect(getDetail(db, localId)?.id).toBe(localId);
    expect(queueForUpload(db, 'missing')).toBeNull();
  });

  it('keeps addresses and a new vehicle on the row and the trip page', () => {
    const db = setup();
    upsertTrips(db, [trip('a')]);
    putDetail(db, detail('a'));
    setTripAddresses(db, 'a', 'Sector 29, Gurugram', 'Dwarka, Delhi');
    setTripVehicle(db, 'a', 'v2', 'City bike');
    expect(listTrips(db, {search: 'gurugram'}).items[0]).toMatchObject({start_address: 'Sector 29, Gurugram', vehicle_name: 'City bike'});
    expect(listTrips(db, {vehicleId: 'v2'}).total).toBe(1);
    expect(getDetail(db, 'a')).toMatchObject({start_address: 'Sector 29, Gurugram', end_address: 'Dwarka, Delhi', vehicle_id: 'v2'});
  });
});

describe('backup files', () => {
  it('round-trips every drive and route, skipping drives already on the phone', () => {
    const from = setup();
    upsertTrips(from, [trip('a'), trip('b', {start_time: '2026-10-11T08:00:00.000Z'})]);
    putDetail(from, detail('a'));
    const text = JSON.stringify(backupSnapshot(from));

    const to = setup();
    upsertTrips(to, [trip('b', {start_time: '2026-10-11T08:00:00.000Z'})]);
    expect(restoreBackup(to, parseBackup(text))).toEqual({added: 1, skipped: 1});
    expect(getDetail(to, 'a')?.location_points).toHaveLength(2);
    expect(isInCloud(to, 'a')).toBe(false);
    expect(restoreBackup(to, parseBackup(text))).toEqual({added: 0, skipped: 2});
  });

  it('refuses files that are not a backup, or from a newer app', () => {
    expect(() => parseBackup('nope')).toThrow('not a DriveSense backup');
    expect(() => parseBackup('{"format":"other","trips":[]}')).toThrow('not a DriveSense backup');
    expect(() => parseBackup('{"format":"drivesense-backup","version":99,"trips":[]}')).toThrow('newer DriveSense');
  });
});

describe('the setting', () => {
  let db: SqlDb;
  beforeEach(() => {
    db = setup();
    setDbForTests(db);
  });
  afterEach(() => {
    setDbForTests(null);
    usePreferencesStore.setState({driveBackup: 'cloud'});
  });

  it('back to the cloud, queues every drive the server does not have', async () => {
    upsertTrips(db, [trip('a'), trip('b', {start_time: '2026-10-11T08:00:00.000Z'})]);
    putDetail(db, detail('a'));
    db.run("UPDATE trips SET in_cloud = 0 WHERE id = 'a'");
    expect(await setDriveBackup('phone', db)).toBe(0);
    expect(usePreferencesStore.getState().driveBackup).toBe('phone');
    expect(await setDriveBackup('cloud', db)).toBe(1);
    expect(outboxList(db)).toHaveLength(1);
  });

  it('deletes cloud data only once every route is on the phone', async () => {
    upsertTrips(db, [trip('a'), trip('b', {start_time: '2026-10-11T08:00:00.000Z'})]);
    putDetail(db, detail('a'));
    const post = jest.fn().mockResolvedValue(undefined);
    (tripDetailApi.get as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('Network Error'), {isAxiosError: true}));
    await expect(deleteCloudDrives('pw', db, post)).rejects.toBeInstanceOf(CloudDeleteBlocked);
    expect(post).not.toHaveBeenCalled();

    (tripDetailApi.get as jest.Mock).mockResolvedValueOnce(detail('b'));
    await deleteCloudDrives('pw', db, post);
    expect(post).toHaveBeenCalledWith({password: 'pw'});
    expect(localOnlyTrips(db)).toHaveLength(2);
  });

  it('a wrong password changes nothing on the phone', async () => {
    upsertTrips(db, [trip('a')]);
    putDetail(db, detail('a'));
    const denied = Object.assign(new Error('403'), {isAxiosError: true, response: {status: 403}});
    await expect(deleteCloudDrives('bad', db, () => Promise.reject(denied))).rejects.toBe(denied);
    expect(localOnlyTrips(db)).toEqual([]);
  });
});

describe('addressFrom', () => {
  it('reads like the server: the street or place, then the city', () => {
    expect(addressFrom({street: 'Sector 29', city: 'Gurugram'} as never)).toBe('Sector 29, Gurugram');
    expect(addressFrom({name: 'Cyber Hub', district: 'DLF', city: null, subregion: 'Gurugram'} as never)).toBe('Cyber Hub, Gurugram');
    expect(addressFrom({city: 'Delhi', region: 'Delhi'} as never)).toBe('Delhi');
    expect(addressFrom(undefined)).toBeNull();
  });
});
