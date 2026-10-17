import {tripUploadApi} from '../../services/tripService';
import {useFinishedDriveStore} from '../finishedDriveStore';
import type {FinishedDrive} from '../recordingStore';

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
});
