import {tripUploadApi} from '../../services/tripService';
import {EMPTY_STATS, useRecordingStore, type Sample} from '../../stores/recordingStore';
import {syncNow, takeOrphans} from '../tripSync';

jest.mock('../../services/tripService', () => ({
  tripUploadApi: {start: jest.fn(), locations: jest.fn(), end: jest.fn(), remove: jest.fn()},
}));

const api = tripUploadApi as jest.Mocked<typeof tripUploadApi>;

const sample = (i: number): Sample => ({
  latitude: 28.6 + i * 0.00013,
  longitude: 77.2,
  speedMps: 14,
  altitudeM: null,
  headingDeg: 0,
  accuracyM: 5,
  timestamp: 1000 * (i + 1),
});

const reset = () => {
  useRecordingStore.getState().end();
  useRecordingStore.setState({position: null, stats: EMPTY_STATS, justFinished: null, pending: []});
};

describe('tripSync', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    reset();
    api.start.mockResolvedValue({id: 't1', driving_score: null});
    api.locations.mockResolvedValue({});
  });

  it('does nothing at Ready or without a vehicle', async () => {
    await syncNow();
    useRecordingStore.getState().start(null, 0);
    await syncNow();
    expect(api.start).not.toHaveBeenCalled();
  });

  it('starts the server trip backdated, then uploads the queue', async () => {
    useRecordingStore.getState().start({id: 'v1', name: 'Citigo'}, 5000);
    [0, 1, 2].forEach((i) => useRecordingStore.getState().ingest(sample(i)));
    await syncNow();
    expect(api.start).toHaveBeenCalledWith('v1', new Date(5000).toISOString());
    expect(api.locations).toHaveBeenCalledWith('t1', expect.arrayContaining([expect.objectContaining({latitude: 28.6})]));
    const state = useRecordingStore.getState();
    expect(state.tripId).toBe('t1');
    expect(state.pending).toEqual([]);
    expect(state.syncState).toBe('live');
  });

  it('keeps points queued when offline and sends them next time', async () => {
    useRecordingStore.getState().start({id: 'v1', name: 'Citigo'}, 0);
    [0, 1].forEach((i) => useRecordingStore.getState().ingest(sample(i)));
    api.locations.mockRejectedValueOnce(new Error('offline'));
    await syncNow();
    expect(useRecordingStore.getState().syncState).toBe('offline');
    expect(useRecordingStore.getState().pending).toHaveLength(2);
    await syncNow();
    expect(api.start).toHaveBeenCalledTimes(1);
    expect(useRecordingStore.getState().pending).toHaveLength(0);
  });

  it('hands a batch that failed after End to the finish step instead of losing it', async () => {
    useRecordingStore.getState().start({id: 'v1', name: 'Citigo'}, 0);
    useRecordingStore.getState().markTripStarted('t1');
    [0, 1].forEach((i) => useRecordingStore.getState().ingest(sample(i)));
    let fail: (error: Error) => void = () => undefined;
    api.locations.mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)));
    const running = syncNow();
    await Promise.resolve();
    useRecordingStore.getState().end();
    fail(new Error('offline'));
    await running;
    expect(takeOrphans('t1')).toHaveLength(2);
  });
});
