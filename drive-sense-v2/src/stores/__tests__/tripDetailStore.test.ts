import {tripDetailApi, tripUploadApi, type TripDetail} from '../../services/tripService';
import {useTripDetailStore} from '../tripDetailStore';

jest.mock('../../services/tripService', () => ({
  tripDetailApi: {get: jest.fn(), updateVehicle: jest.fn()},
  tripUploadApi: {remove: jest.fn()},
}));

const api = tripDetailApi as jest.Mocked<typeof tripDetailApi>;
const upload = tripUploadApi as jest.Mocked<typeof tripUploadApi>;

const detail = (overrides: Partial<TripDetail> = {}): TripDetail => ({
  id: 't1',
  vehicle_id: 'v1',
  vehicle_name: 'City',
  start_time: '2026-10-11T14:49:00Z',
  end_time: '2026-10-11T15:07:00Z',
  distance_meters: 5400,
  duration_seconds: 1080,
  avg_speed_mps: 6,
  max_speed_mps: 15.5,
  driving_score: 86,
  idle_time_seconds: 195,
  fuel_used_liters: null,
  max_g_force: null,
  max_g_source: null,
  left_turns: 3,
  right_turns: 2,
  start_address: 'Connaught Place',
  end_address: 'Noida',
  location_points: [],
  events: [],
  insights: [],
  ...overrides,
});

const notFound = Object.assign(new Error('Request failed'), {isAxiosError: true, response: {status: 404, data: {detail: 'Trip not found'}}});

describe('tripDetailStore', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    useTripDetailStore.setState({trips: {}, actionError: null, busy: false});
  });

  it('loads a trip once and serves it from cache after', async () => {
    api.get.mockResolvedValue(detail());
    await useTripDetailStore.getState().load('t1');
    await useTripDetailStore.getState().load('t1');
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(useTripDetailStore.getState().trips.t1.status).toBe('ready');
  });

  it('refetches when forced', async () => {
    api.get.mockResolvedValue(detail());
    await useTripDetailStore.getState().load('t1');
    await useTripDetailStore.getState().load('t1', {force: true});
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('marks a 404 as missing and other failures as error', async () => {
    api.get.mockRejectedValueOnce(notFound);
    await useTripDetailStore.getState().load('gone');
    expect(useTripDetailStore.getState().trips.gone.status).toBe('missing');

    api.get.mockRejectedValueOnce(new Error('boom'));
    await useTripDetailStore.getState().load('t2');
    expect(useTripDetailStore.getState().trips.t2.status).toBe('error');
    expect(useTripDetailStore.getState().trips.t2.error).toBeTruthy();
  });

  it('deletes a trip and drops it from the cache', async () => {
    api.get.mockResolvedValue(detail());
    upload.remove.mockResolvedValue(undefined);
    await useTripDetailStore.getState().load('t1');
    expect(await useTripDetailStore.getState().remove('t1')).toBe(true);
    expect(upload.remove).toHaveBeenCalledWith('t1');
    expect(useTripDetailStore.getState().trips.t1).toBeUndefined();
  });

  it('keeps the trip and reports when delete fails', async () => {
    api.get.mockResolvedValue(detail());
    upload.remove.mockRejectedValue(new Error('offline'));
    await useTripDetailStore.getState().load('t1');
    expect(await useTripDetailStore.getState().remove('t1')).toBe(false);
    expect(useTripDetailStore.getState().trips.t1.status).toBe('ready');
    expect(useTripDetailStore.getState().actionError).toBeTruthy();
  });

  it('changes the vehicle then reloads the trip', async () => {
    api.get.mockResolvedValueOnce(detail()).mockResolvedValueOnce(detail({vehicle_id: 'v2', vehicle_name: 'Swift'}));
    api.updateVehicle.mockResolvedValue(undefined);
    await useTripDetailStore.getState().load('t1');
    expect(await useTripDetailStore.getState().changeVehicle('t1', 'v2')).toBe(true);
    expect(api.updateVehicle).toHaveBeenCalledWith('t1', 'v2');
    expect(useTripDetailStore.getState().trips.t1.detail?.vehicle_name).toBe('Swift');
  });
});
