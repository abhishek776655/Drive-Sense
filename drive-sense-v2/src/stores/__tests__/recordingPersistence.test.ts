import {restoreSession, snapshotSession} from '../recordingPersistence';
import {EMPTY_STATS, useRecordingStore} from '../recordingStore';

describe('recording persistence', () => {
  beforeEach(() => {
    useRecordingStore.getState().end();
    useRecordingStore.setState({position: null, stats: EMPTY_STATS});
  });

  it('saves nothing at Ready', () => {
    expect(snapshotSession(useRecordingStore.getState())).toBeNull();
  });

  it('keeps the queue and trip id so uploads resume after a restart', () => {
    useRecordingStore.getState().start({id: 'v1', name: 'Citigo'}, 0);
    useRecordingStore.getState().markTripStarted('t1');
    useRecordingStore.getState().ingest({latitude: 28.6, longitude: 77.2, speedMps: 10, altitudeM: null, headingDeg: 0, accuracyM: 5, timestamp: 1000});
    const snapshot = snapshotSession(useRecordingStore.getState());
    expect(snapshot?.tripId).toBe('t1');
    expect(snapshot?.pending).toHaveLength(1);
    expect(snapshot?.vehicle?.id).toBe('v1');
  });

  it('brings an interrupted drive back paused at its last fix', () => {
    useRecordingStore.getState().start({id: 'v1', name: 'Citigo'}, 0);
    useRecordingStore.getState().ingest({latitude: 28.6, longitude: 77.2, speedMps: 10, altitudeM: null, headingDeg: 0, accuracyM: 5, timestamp: 10_000});
    const snapshot = snapshotSession(useRecordingStore.getState())!;
    const restored = restoreSession(snapshot, 10_000 + 5 * 60_000);
    expect(restored.status).toBe('paused');
    expect(restored.pausedAt).toBe(10_000);
    expect(restored.stats?.speedMps).toBe(0);
  });

  it('a drive still recording in the background stays recording', () => {
    useRecordingStore.getState().start({id: 'v1', name: 'Citigo'}, 0);
    useRecordingStore.getState().ingest({latitude: 28.6, longitude: 77.2, speedMps: 10, altitudeM: null, headingDeg: 0, accuracyM: 5, timestamp: 10_000});
    const restored = restoreSession(snapshotSession(useRecordingStore.getState())!, 30_000);
    expect(restored.status).toBe('recording');
  });
});
