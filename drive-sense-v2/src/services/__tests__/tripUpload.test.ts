import type {FinishedDrive, Sample} from '../../stores/recordingStore';
import {AxiosError, AxiosHeaders} from 'axios';
import {NO_PROGRESS, progressFor, toPointPayload, UPLOAD_BATCH, uploadDrive} from '../tripUpload';
import {tripUploadApi} from '../tripService';

jest.mock('../tripService', () => ({
  tripUploadApi: {start: jest.fn(), locations: jest.fn(), end: jest.fn(), finish: jest.fn(), remove: jest.fn()},
}));

const api = tripUploadApi as jest.Mocked<typeof tripUploadApi>;

const sample = (i: number): Sample => ({
  latitude: 28.6 + i * 0.0001,
  longitude: 77.2,
  speedMps: 10,
  altitudeM: 200,
  headingDeg: 90,
  accuracyM: 5,
  timestamp: 1_700_000_000_000 + i * 1000,
});

const drive = (count: number, vehicle: FinishedDrive['vehicle'] = {id: 'v1', name: 'Citigo'}): FinishedDrive => ({
  vehicle,
  tripId: null,
  autoEnded: false,
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_600_000,
  durationSeconds: 540,
  distanceM: 4210.4,
  topSpeedMps: 20,
  avgSpeedMps: 7.8,
  eventCount: 1,
  maxG: 0.4,
  route: [],
  unsentSamples: Array.from({length: count}, (_, i) => sample(i)),
});

describe('uploadDrive', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    api.start.mockResolvedValue({id: 't1', driving_score: null});
    api.locations.mockResolvedValue({});
    api.end.mockResolvedValue({id: 't1', driving_score: 88});
  });

  it('starts backdated, uploads points in batches, then ends with moving time', async () => {
    const result = await uploadDrive(drive(UPLOAD_BATCH + 50), drive(UPLOAD_BATCH + 50).unsentSamples, NO_PROGRESS, () => undefined);
    expect(api.start).toHaveBeenCalledWith('v1', new Date(1_700_000_000_000).toISOString());
    expect(api.locations).toHaveBeenCalledTimes(2);
    expect(api.locations.mock.calls[0][1]).toHaveLength(UPLOAD_BATCH);
    expect(api.locations.mock.calls[1][1]).toHaveLength(50);
    expect(api.end).toHaveBeenCalledWith({
      vehicle_id: 'v1',
      end_time: new Date(1_700_000_600_000).toISOString(),
      distance_meters: 4210,
      duration_seconds: 540,
    });
    expect(result).toEqual({tripId: 't1', uploadedPoints: UPLOAD_BATCH + 50, ended: true});
  });

  it('skips the points call for a drive with no fixes', async () => {
    await uploadDrive(drive(0), drive(0).unsentSamples, NO_PROGRESS, () => undefined);
    expect(api.locations).not.toHaveBeenCalled();
    expect(api.end).toHaveBeenCalled();
  });

  it('resumes after a failure without starting a second trip', async () => {
    const steps: unknown[] = [];
    api.locations.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('offline'));
    await expect(uploadDrive(drive(UPLOAD_BATCH * 2), drive(UPLOAD_BATCH * 2).unsentSamples, NO_PROGRESS, (p: unknown) => steps.push(p))).rejects.toThrow('offline');
    const last = steps[steps.length - 1] as typeof NO_PROGRESS;
    expect(last).toEqual({tripId: 't1', uploadedPoints: UPLOAD_BATCH, ended: false});

    await uploadDrive(drive(UPLOAD_BATCH * 2), drive(UPLOAD_BATCH * 2).unsentSamples, last, () => undefined);
    expect(api.start).toHaveBeenCalledTimes(1);
    expect(api.locations).toHaveBeenCalledTimes(3);
    expect(api.end).toHaveBeenCalledTimes(1);
  });

  it('refuses to save without a vehicle', async () => {
    await expect(uploadDrive(drive(3, null), drive(3, null).unsentSamples, NO_PROGRESS, () => undefined)).rejects.toThrow('Choose a vehicle');
    expect(api.start).not.toHaveBeenCalled();
  });

  it('continues the trip the live sync already started', async () => {
    const live = {...drive(3), tripId: 't-live'};
    await uploadDrive(live, live.unsentSamples, progressFor(live), () => undefined);
    expect(api.start).not.toHaveBeenCalled();
    expect(api.locations).toHaveBeenCalledWith('t-live', expect.any(Array));
  });

  it('treats a trip the server already closed as saved', async () => {
    const closed = new AxiosError('Not Found', '404', {headers: new AxiosHeaders()} as never);
    closed.response = {status: 404, data: {detail: 'No active trip for vehicle'}, statusText: '', headers: {}, config: {} as never} as never;
    api.end.mockRejectedValueOnce(closed);
    const result = await uploadDrive(drive(1), drive(1).unsentSamples, NO_PROGRESS, () => undefined);
    expect(result.ended).toBe(true);
  });

  it('sends the peak G recorded with each fix', () => {
    expect(toPointPayload({...sample(0), peakG: 0.4123}).peak_g).toBe(0.412);
    expect(toPointPayload({...sample(0), peakG: 9}).peak_g).toBeNull();
    expect(toPointPayload(sample(0)).peak_g).toBeNull();
  });

  it('drops invalid sensor values from the payload', () => {
    const payload = toPointPayload({...sample(0), speedMps: -1, headingDeg: -1, accuracyM: null});
    expect(payload.speed_mps).toBeNull();
    expect(payload.heading_deg).toBeNull();
    expect(payload.accuracy_m).toBeNull();
  });
});

describe('uploadDrive with the phone numbers (local-first part 2b)', () => {
  const metrics = {
    events: [{event_type: 'harsh_brake' as const, intensity: 1.2, occurred_at: '2023-11-14T22:13:25.000Z', latitude: 28.6, longitude: 77.2}],
    score: 98,
    leftTurns: 2,
    rightTurns: 1,
    maxG: 0.41234,
    maxGSource: 'sensor' as const,
    idleSeconds: 30,
  };
  beforeEach(() => {
    jest.resetAllMocks();
    api.start.mockResolvedValue({id: 't1', driving_score: null});
  });

  it('ends through /finish with the phone score, events, turns and G', async () => {
    api.finish.mockResolvedValue({id: 't1', driving_score: 98});
    const done = await uploadDrive(drive(1), drive(1).unsentSamples, NO_PROGRESS, () => {}, metrics);
    expect(done.ended).toBe(true);
    expect(api.end).not.toHaveBeenCalled();
    expect(api.finish).toHaveBeenCalledWith('t1', {
      end_time: new Date(1_700_000_600_000).toISOString(),
      distance_meters: 4210,
      duration_seconds: 540,
      idle_time_seconds: 30,
      driving_score: 98,
      max_g_force: 0.412,
      max_g_source: 'sensor',
      left_turns: 2,
      right_turns: 1,
      events: metrics.events,
    });
  });

  it('falls back to /end on a server that has no /finish yet', async () => {
    const missing = new AxiosError('Not Found', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 404,
      data: {detail: 'Not Found'},
      statusText: 'Not Found',
      headers: {},
      config: {headers: new AxiosHeaders()},
    });
    api.finish.mockRejectedValue(missing);
    api.end.mockResolvedValue({id: 't1', driving_score: 90});
    await uploadDrive(drive(1), drive(1).unsentSamples, NO_PROGRESS, () => {}, metrics);
    expect(api.end).toHaveBeenCalled();
  });

  it('keeps a real /finish failure for the retry', async () => {
    api.finish.mockRejectedValue(new Error('timeout'));
    await expect(uploadDrive(drive(1), drive(1).unsentSamples, NO_PROGRESS, () => {}, metrics)).rejects.toThrow('timeout');
    expect(api.end).not.toHaveBeenCalled();
  });
});
