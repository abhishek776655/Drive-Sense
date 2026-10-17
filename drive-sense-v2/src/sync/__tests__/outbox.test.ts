import {migrate} from '../../db/schema';
import {getDetail, listTrips, outboxId, outboxList, outboxPut, putLocalTrip} from '../../db/repos';
import {NO_PROGRESS, type UploadProgress} from '../../services/tripUpload';
import type {FinishedDrive} from '../../stores/recordingStore';
import {memoryDb} from '../../testUtils/memoryDb';
import {flushOutbox, isOfflineError} from '../outbox';

const drive = (startedAt: number): FinishedDrive => ({
  vehicle: {id: 'v1', name: 'Skoda Octavia'},
  tripId: null,
  startedAt,
  endedAt: startedAt + 23 * 60_000,
  durationSeconds: 23 * 60,
  distanceM: 12_400,
  topSpeedMps: 25,
  avgSpeedMps: 9,
  eventCount: 2,
  score: 91,
  maxG: 0.4,
  route: [
    {latitude: 28.6, longitude: 77.2},
    {latitude: 28.61, longitude: 77.21},
  ],
  unsentSamples: [],
  autoEnded: false,
});

const offline = Object.assign(new Error('Network Error'), {isAxiosError: true, response: undefined});

const setup = () => {
  const db = memoryDb();
  migrate(db);
  return db;
};

const save = (db: ReturnType<typeof setup>, d: FinishedDrive, progress: UploadProgress = NO_PROGRESS) => {
  outboxPut(db, {id: outboxId(d), drive: d, samples: [], progress});
  putLocalTrip(db, d);
};

describe('drives saved on the phone first', () => {
  it('shows a saved drive in the Logbook at once, with the phone numbers, marked pending', () => {
    const db = setup();
    save(db, drive(Date.UTC(2026, 9, 17, 8)));
    const [row] = listTrips(db, {}).items;
    expect(row).toMatchObject({id: 'local:1792224000000', pending: true, driving_score: 91, distance_meters: 12_400, vehicle_name: 'Skoda Octavia'});
    expect(getDetail(db, row.id)?.location_points).toHaveLength(2);
  });

  it('uploads oldest first and swaps the stand-in row out once each is up', async () => {
    const db = setup();
    save(db, drive(2000));
    save(db, drive(1000));
    const upload = jest.fn(async (_d: FinishedDrive, _s: unknown, p: UploadProgress, onProgress: (n: UploadProgress) => void) => {
      const done = {...p, tripId: 'server-trip', uploadedPoints: 0, ended: true};
      onProgress(done);
      return done;
    });
    expect(await flushOutbox(db, () => false, upload as never)).toBe(2);
    expect(upload.mock.calls.map((c) => c[0].startedAt)).toEqual([2000, 1000].sort());
    expect(outboxList(db)).toEqual([]);
    expect(listTrips(db, {}).total).toBe(0);
  });

  it('keeps everything when offline, and resumes from the saved progress next time', async () => {
    const db = setup();
    save(db, drive(1000));
    const failing = jest.fn(async (_d: FinishedDrive, _s: unknown, p: UploadProgress, onProgress: (n: UploadProgress) => void) => {
      onProgress({...p, tripId: 't1'});
      throw offline;
    });
    expect(await flushOutbox(db, () => false, failing as never)).toBe(0);
    expect(outboxList(db)[0].progress.tripId).toBe('t1');
    expect(listTrips(db, {}).items[0].pending).toBe(true);

    const resumed = jest.fn(async (_d: FinishedDrive, _s: unknown, p: UploadProgress) => ({...p, ended: true}));
    expect(await flushOutbox(db, () => false, resumed as never)).toBe(1);
    expect(resumed.mock.calls[0][2].tripId).toBe('t1');
  });

  it('leaves out the drive the summary screen is still saving', async () => {
    const db = setup();
    save(db, drive(1000));
    const upload = jest.fn();
    expect(await flushOutbox(db, (id) => id === 'local:1000', upload)).toBe(0);
    expect(upload).not.toHaveBeenCalled();
  });

  it('treats no response and gateway errors as offline, but not a refusal', () => {
    expect(isOfflineError(offline)).toBe(true);
    expect(isOfflineError({isAxiosError: true, response: {status: 502}})).toBe(true);
    expect(isOfflineError({isAxiosError: true, response: {status: 422}})).toBe(false);
    expect(isOfflineError(new Error('x'))).toBe(false);
  });
});
