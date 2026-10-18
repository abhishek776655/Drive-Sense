import {DEFAULT_PREFERENCES, usePreferencesStore} from '../preferencesStore';
import {avgSpeedMps, elapsedSeconds, EMPTY_STATS, useRecordingStore, type Sample} from '../recordingStore';

const sample = (overrides: Partial<Sample>): Sample => ({
  latitude: 28.6,
  longitude: 77.2,
  speedMps: 10,
  altitudeM: 200,
  headingDeg: 0,
  accuracyM: 5,
  timestamp: 0,
  ...overrides,
});

describe('recordingStore', () => {
  beforeEach(() => {
    useRecordingStore.getState().end();
    useRecordingStore.setState({position: null, defaultVehicle: null, justFinished: null, stats: EMPTY_STATS});
    usePreferencesStore.setState(DEFAULT_PREFERENCES);
  });

  const parkFor = (seconds: number) => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    const store = useRecordingStore.getState();
    store.start({id: 'v1', name: 'Citigo'}, 0);
    now.mockReturnValue(1000);
    store.ingest(sample({timestamp: 1000, speedMps: 10}));
    for (let t = 2000; t <= seconds * 1000; t += 1000) {
      now.mockReturnValue(t);
      store.ingest(sample({timestamp: t, speedMps: 0, latitude: 28.60001}));
      if (useRecordingStore.getState().status === 'ready') {
        break;
      }
    }
    now.mockRestore();
    return useRecordingStore.getState().status;
  };

  it('auto-stop follows Settings: its delay, or never when switched off', () => {
    usePreferencesStore.setState({autoStopMinutes: 1});
    expect(parkFor(65)).toBe('ready');
    useRecordingStore.setState({justFinished: null});
    usePreferencesStore.setState({autoStopMinutes: 3, autoStop: false});
    expect(parkFor(400)).toBe('recording');
  });

  it('auto-pause pauses after standing still, then resumes on driving off; a tapped pause stays paused', () => {
    usePreferencesStore.setState({autoPause: true, autoPauseSeconds: 30, autoStopMinutes: 10});
    expect(parkFor(40)).toBe('paused');
    const paused = useRecordingStore.getState();
    expect(paused.autoPaused).toBe(true);
    // The standing time from the last movement (1 s) is the pause, not driving time.
    expect(paused.pausedAt).toBe(1000);
    const now = jest.spyOn(Date, 'now');
    for (const t of [41_000, 42_000]) {
      now.mockReturnValue(t);
      paused.ingest(sample({timestamp: t, speedMps: 8, latitude: 28.6003}));
    }
    expect(useRecordingStore.getState()).toMatchObject({status: 'recording', autoPaused: false});
    // Pausing by hand: driving does not resume it.
    useRecordingStore.getState().pause();
    for (const t of [43_000, 44_000, 45_000]) {
      now.mockReturnValue(t);
      useRecordingStore.getState().ingest(sample({timestamp: t, speedMps: 8, latitude: 28.6006}));
    }
    expect(useRecordingStore.getState().status).toBe('paused');
    now.mockRestore();
  });

  it('auto-pause off by default, and auto-stop still ends a drive left auto-paused', () => {
    expect(parkFor(60)).toBe('recording');
    usePreferencesStore.setState({autoPause: true, autoPauseSeconds: 30, autoStopMinutes: 1});
    useRecordingStore.getState().end();
    useRecordingStore.setState({justFinished: null});
    expect(parkFor(70)).toBe('ready');
  });

  it('never auto-starts with Auto-start off', () => {
    usePreferencesStore.setState({autoStart: false});
    const now = jest.spyOn(Date, 'now');
    const store = useRecordingStore.getState();
    store.setDefaultVehicle({id: 'v1', name: 'Citigo'});
    for (const t of [1000, 2000, 3000]) {
      now.mockReturnValue(t);
      store.ingest(sample({timestamp: t, speedMps: 10}));
    }
    expect(useRecordingStore.getState().status).toBe('ready');
    now.mockRestore();
  });

  it('fires the speed alert on going over the limit, only when it is on', () => {
    const now = jest.spyOn(Date, 'now');
    const store = useRecordingStore.getState();
    store.start(null, 0);
    now.mockReturnValue(1000);
    store.ingest(sample({timestamp: 1000, speedMps: 30}));
    expect(useRecordingStore.getState().speedAlert.lastAlertAt).toBeNull();
    usePreferencesStore.setState({speedAlert: true, speedAlertKmh: 100});
    now.mockReturnValue(2000);
    store.ingest(sample({timestamp: 2000, speedMps: 30}));
    expect(useRecordingStore.getState().speedAlert).toEqual({over: true, lastAlertAt: 2000});
    now.mockRestore();
  });

  it('excludes paused time from the clock', () => {
    expect(elapsedSeconds({startedAt: 0, pausedMs: 0, pausedAt: null}, 60_000)).toBe(60);
    expect(elapsedSeconds({startedAt: 0, pausedMs: 20_000, pausedAt: null}, 60_000)).toBe(40);
    expect(elapsedSeconds({startedAt: 0, pausedMs: 0, pausedAt: 50_000}, 60_000)).toBe(50);
  });

  it('moves Ready → Recording → Paused → Recording, and End returns to Ready', () => {
    const store = useRecordingStore.getState();
    store.start(null);
    expect(useRecordingStore.getState().status).toBe('recording');
    store.ingest(sample({timestamp: 1000, speedMps: 15}));
    store.pause();
    expect(useRecordingStore.getState().status).toBe('paused');
    expect(useRecordingStore.getState().stats.speedMps).toBe(0);
    store.resume();
    expect(useRecordingStore.getState().status).toBe('recording');
    store.end();
    expect(useRecordingStore.getState().status).toBe('ready');
  });

  it('accumulates distance, top speed and events only while recording', () => {
    const store = useRecordingStore.getState();
    store.ingest(sample({timestamp: 0}));
    expect(useRecordingStore.getState().stats.distanceM).toBe(0);
    store.start(null);
    store.ingest(sample({timestamp: 1000, speedMps: 10}));
    store.ingest(sample({timestamp: 2000, latitude: 28.60013, speedMps: 14}));
    const {stats} = useRecordingStore.getState();
    expect(stats.distanceM).toBeGreaterThan(12);
    expect(stats.topSpeedMps).toBe(14);
    expect(stats.eventCount).toBe(1);
    expect(useRecordingStore.getState().lastEvent?.kind).toBe('rapid_acceleration');
  });

  it('End returns the finished drive with moving time and resets to Ready', () => {
    const store = useRecordingStore.getState();
    expect(store.end()).toBeNull();
    store.start({id: 'v1', name: 'Citigo'});
    store.ingest(sample({timestamp: 1000, speedMps: 12}));
    store.ingest(sample({timestamp: 2000, latitude: 28.60013, speedMps: 14}));
    const finished = useRecordingStore.getState().end();
    expect(finished?.vehicle).toEqual({id: 'v1', name: 'Citigo'});
    expect(finished?.unsentSamples).toHaveLength(2);
    expect(finished?.tripId).toBeNull();
    expect(useRecordingStore.getState().justFinished).toBe(finished);
    expect(finished?.topSpeedMps).toBe(14);
    expect(finished?.distanceM).toBeGreaterThan(12);
    expect(useRecordingStore.getState().status).toBe('ready');
    expect(useRecordingStore.getState().pending).toEqual([]);
  });

  it('tracks moving, accuracy and a held heading even at Ready', () => {
    const store = useRecordingStore.getState();
    store.ingest(sample({timestamp: 1000, speedMps: 10, headingDeg: 90, accuracyM: 4}));
    let stats = useRecordingStore.getState().stats;
    expect(stats.altitudeM).toBe(200);
    expect(stats.moving).toBe(true);
    expect(stats.accuracyM).toBe(4);
    expect(stats.headingDeg).toBe(90);
    store.ingest(sample({timestamp: 2000, speedMps: 0, headingDeg: -1}));
    stats = useRecordingStore.getState().stats;
    expect(stats.moving).toBe(false);
    expect(stats.headingDeg).toBe(90);
  });

  it('turns accelerometer peaks into live G, max G and smoothness only while recording', () => {
    const store = useRecordingStore.getState();
    store.ingestMotion(4);
    expect(useRecordingStore.getState().stats.liveG).toBeNull();
    store.start(null);
    store.ingestMotion(4);
    store.ingestMotion(1);
    const {stats} = useRecordingStore.getState();
    expect(stats.liveG).toBeCloseTo(1 / 9.81, 5);
    expect(stats.maxG).toBeCloseTo(4 / 9.81, 5);
    expect(stats.smoothness).toBe('smooth');
    store.ingest(sample({timestamp: 1000}));
    const queued = useRecordingStore.getState().pending;
    expect(queued[queued.length - 1].peakG).toBeCloseTo(4 / 9.81, 5);
    expect(useRecordingStore.getState().motionPeakG).toBeNull();
  });

  it('auto-starts after two fresh fixes at 2.2 m/s, only with a vehicle', () => {
    const now = jest.spyOn(Date, 'now');
    const store = useRecordingStore.getState();
    now.mockReturnValue(2000);
    store.ingest(sample({timestamp: 1000, speedMps: 5}));
    store.ingest(sample({timestamp: 2000, speedMps: 5}));
    expect(useRecordingStore.getState().status).toBe('ready');
    store.setDefaultVehicle({id: 'v1', name: 'Citigo'});
    now.mockReturnValue(3000);
    store.ingest(sample({timestamp: 3000, speedMps: 2.3}));
    expect(useRecordingStore.getState().status).toBe('ready');
    now.mockReturnValue(4000);
    store.ingest(sample({timestamp: 4000, speedMps: 2.3}));
    expect(useRecordingStore.getState().status).toBe('recording');
    expect(useRecordingStore.getState().vehicle).toEqual({id: 'v1', name: 'Citigo'});
    expect(useRecordingStore.getState().startedAt).toBe(4000);
    now.mockRestore();
  });

  it('a stale or replayed fix never starts or ends a drive', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const store = useRecordingStore.getState();
    store.setDefaultVehicle({id: 'v1', name: 'Citigo'});
    store.ingest(sample({timestamp: 1000, speedMps: 20}));
    store.ingest(sample({timestamp: 2000, speedMps: 20}));
    expect(useRecordingStore.getState().status).toBe('ready');
    store.start({id: 'v1', name: 'Citigo'}, 0);
    for (let t = 3000; t <= 300_000; t += 1000) {
      store.ingest(sample({timestamp: t, speedMps: 0}));
    }
    expect(useRecordingStore.getState().status).toBe('recording');
    now.mockRestore();
  });

  it('auto-ends after 3 minutes parked, handing the drive over for its summary', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(0);
    const store = useRecordingStore.getState();
    store.start({id: 'v1', name: 'Citigo'}, 0);
    now.mockReturnValue(1000);
    store.ingest(sample({timestamp: 1000, speedMps: 10}));
    for (let t = 2000; t <= 181_000; t += 1000) {
      now.mockReturnValue(t);
      store.ingest(sample({timestamp: t, speedMps: 0, latitude: 28.60001}));
      if (useRecordingStore.getState().status === 'ready') {
        break;
      }
    }
    const state = useRecordingStore.getState();
    expect(state.status).toBe('ready');
    expect(state.justFinished?.autoEnded).toBe(true);
    expect(state.consumeFinished()?.vehicle?.id).toBe('v1');
    expect(useRecordingStore.getState().justFinished).toBeNull();
    now.mockRestore();
  });

  it('drops a poor GPS fix once it has a good one', () => {
    const store = useRecordingStore.getState();
    store.start(null, 0);
    store.ingest(sample({timestamp: 1000, accuracyM: 5}));
    store.ingest(sample({timestamp: 2000, latitude: 28.6005, accuracyM: 80}));
    expect(useRecordingStore.getState().pending).toHaveLength(1);
  });

  it('queues fixes for upload and puts a failed batch back in front', () => {
    const store = useRecordingStore.getState();
    store.start(null, 0);
    store.ingest(sample({timestamp: 1000}));
    store.ingest(sample({timestamp: 2000, latitude: 28.60013}));
    const batch = store.takePending(1);
    expect(useRecordingStore.getState().pending).toHaveLength(1);
    store.returnPending(batch);
    expect(useRecordingStore.getState().pending.map((s) => s.timestamp)).toEqual([1000, 2000]);
  });

  it('average speed uses moving time only: a stop at a light does not drag it down', () => {
    const store = useRecordingStore.getState();
    store.start(null, 0);
    store.ingest(sample({timestamp: 1000, speedMps: 10}));
    store.ingest(sample({timestamp: 2000, latitude: 28.60009, speedMps: 10}));
    store.ingest(sample({timestamp: 3000, latitude: 28.60018, speedMps: 10}));
    for (let t = 4000; t <= 30_000; t += 1000) {
      store.ingest(sample({timestamp: t, latitude: 28.60018, speedMps: 0}));
    }
    const {stats} = useRecordingStore.getState();
    expect(stats.movingSeconds).toBe(2);
    const finished = useRecordingStore.getState().end(30_000);
    expect(finished?.avgSpeedMps).toBeCloseTo(stats.distanceM / 2, 5);
  });

  it('a one-off GPS speed spike never becomes the top speed', () => {
    const store = useRecordingStore.getState();
    store.start(null, 0);
    store.ingest(sample({timestamp: 1000, speedMps: 12}));
    store.ingest(sample({timestamp: 2000, latitude: 28.60012, speedMps: 45}));
    store.ingest(sample({timestamp: 3000, latitude: 28.60024, speedMps: 13}));
    expect(useRecordingStore.getState().stats.topSpeedMps).toBe(13);
    expect(useRecordingStore.getState().stats.speedMps).toBe(13);
  });

  it('counts events by kind for the live score', () => {
    const store = useRecordingStore.getState();
    store.start(null, 0);
    store.ingest(sample({timestamp: 1000, speedMps: 20}));
    store.ingest(sample({timestamp: 2000, latitude: 28.60015, speedMps: 15}));
    store.ingest(sample({timestamp: 3000, latitude: 28.6003, speedMps: 19}));
    const {stats} = useRecordingStore.getState();
    expect(stats.brakeCount).toBe(1);
    expect(stats.accelCount).toBe(1);
  });

  it('ignores a GPS jump instead of counting it as distance', () => {
    const store = useRecordingStore.getState();
    store.start(null);
    store.ingest(sample({timestamp: 1000}));
    store.ingest(sample({timestamp: 2000, latitude: 28.62}));
    expect(useRecordingStore.getState().stats.distanceM).toBe(0);
    store.ingest(sample({timestamp: 3000, latitude: 28.6201}));
    expect(useRecordingStore.getState().stats.distanceM).toBeGreaterThan(5);
    expect(useRecordingStore.getState().stats.distanceM).toBeLessThan(20);
  });

  it('only counts elevation gain above the smoothing threshold', () => {
    const store = useRecordingStore.getState();
    store.start(null);
    store.ingest(sample({timestamp: 1000, altitudeM: 200}));
    store.ingest(sample({timestamp: 2000, altitudeM: 201}));
    store.ingest(sample({timestamp: 3000, altitudeM: 206}));
    store.ingest(sample({timestamp: 4000, altitudeM: 202}));
    expect(useRecordingStore.getState().stats.elevationGainM).toBe(6);
  });

  it('average speed is distance over moving time and null without data', () => {
    expect(avgSpeedMps(1000, 100)).toBe(10);
    expect(avgSpeedMps(0, 100)).toBeNull();
    expect(avgSpeedMps(1000, 0)).toBeNull();
  });
});
