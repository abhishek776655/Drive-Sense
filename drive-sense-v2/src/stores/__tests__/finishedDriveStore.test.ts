import {tripUploadApi} from '../../services/tripService';
import {setDbForTests} from '../../db';
import {getDetail, listTrips, outboxList} from '../../db/repos';
import {migrate} from '../../db/schema';
import {memoryDb} from '../../testUtils/memoryDb';
import {useFinishedDriveStore} from '../finishedDriveStore';
import {usePreferencesStore} from '../preferencesStore';
import * as Location from 'expo-location';
import type {FinishedDrive} from '../recordingStore';

jest.mock('expo-location', () => ({reverseGeocodeAsync: jest.fn()}));
jest.mock('../../services/tripService', () => ({
  tripUploadApi: {start: jest.fn(), locations: jest.fn(), end: jest.fn(), remove: jest.fn()},
}));

const api = tripUploadApi as jest.Mocked<typeof tripUploadApi>;

const drive = (overrides: Partial<FinishedDrive> = {}): FinishedDrive => ({
  vehicle: {id: 'v1', name: 'Citigo'},
  tripId: 't1',
  startedAt: 0,
  endedAt: 60_000,
  durationSeconds: 60,
  distanceM: 500,
  topSpeedMps: 15,
  avgSpeedMps: 8,
  eventCount: 0,
  maxG: null,
  route: [],
  unsentSamples: [],
  autoEnded: false,
  ...overrides,
});

describe('finishedDriveStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    api.end.mockResolvedValue({id: 't1', driving_score: 90});
    api.remove.mockResolvedValue(undefined);
    useFinishedDriveStore.getState().close();
  });

  it('finishes the drive on the server as soon as it is shown', async () => {
    useFinishedDriveStore.getState().show(drive());
    await useFinishedDriveStore.getState().save();
    expect(api.start).not.toHaveBeenCalled();
    expect(api.end).toHaveBeenCalledTimes(1);
    expect(useFinishedDriveStore.getState().saveStatus).toBe('saved');
  });

  it('Discard deletes the server trip, after any save in progress', async () => {
    useFinishedDriveStore.getState().show(drive());
    expect(await useFinishedDriveStore.getState().discard()).toBe(true);
    expect(api.remove).toHaveBeenCalledWith('t1');
    expect(useFinishedDriveStore.getState().drive).toBeNull();
  });

  it('a drive without a vehicle is local only: nothing is sent', async () => {
    useFinishedDriveStore.getState().show(drive({vehicle: null, tripId: null}));
    expect(useFinishedDriveStore.getState().saveStatus).toBe('local');
    expect(await useFinishedDriveStore.getState().save()).toBe(false);
    expect(await useFinishedDriveStore.getState().discard()).toBe(true);
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('with "This phone only", keeps the drive here for good and sends nothing', async () => {
    const db = memoryDb();
    migrate(db);
    setDbForTests(db);
    usePreferencesStore.setState({driveBackup: 'phone'});
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{street: 'Sector 29', city: 'Gurugram'}]);
    try {
      useFinishedDriveStore.getState().show(drive({tripId: null, route: [{latitude: 28.6, longitude: 77.2}]}));
      expect(useFinishedDriveStore.getState().saveStatus).toBe('saved');
      expect(useFinishedDriveStore.getState().detail?.id).toBe('local:0');
      expect(await useFinishedDriveStore.getState().save()).toBe(true);
      expect(api.start).not.toHaveBeenCalled();
      expect(api.end).not.toHaveBeenCalled();
      expect(outboxList(db)).toEqual([]);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(listTrips(db, {}).items[0]).toMatchObject({id: 'local:0', start_address: 'Sector 29, Gurugram'});
      expect(getDetail(db, 'local:0')).not.toBeNull();
    } finally {
      setDbForTests(null);
      usePreferencesStore.setState({driveBackup: 'cloud'});
    }
  });
});
