import {AxiosError, AxiosHeaders} from 'axios';
import {mockApiGet, mockedApiClient, resetApiClientMocks} from '../../testUtils/mockApiClient';
import {homeFromDashboard, homeService, lastTripFrom} from '../homeService';

jest.mock('../apiClient', () => ({
  apiClient: {get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), patch: jest.fn()},
}));

const dashboard = (overrides: Record<string, unknown> = {}) => ({
  summary: {total_trips: 2, total_distance_meters: 12000, total_duration_seconds: 1800, avg_driving_score: 88},
  events: {harsh_brake_count: 1, rapid_acceleration_count: 3},
  recent_trips: [
    {trip_id: 'a', vehicle_name: 'Citigo', state: 'ended', start_time: '2026-10-01T10:00:00Z', distance_meters: 5000, duration_seconds: 600, max_speed_mps: 20, start_address: 'A', end_address: 'B'},
    {trip_id: 'b', vehicle_name: 'Citigo', state: 'ended', start_time: '2026-10-02T10:00:00Z', distance_meters: 7000, duration_seconds: 1200, max_speed_mps: 25, start_address: 'C', end_address: null},
    {trip_id: 'c', vehicle_name: 'Citigo', state: 'active', start_time: '2026-10-03T10:00:00Z', distance_meters: 0, duration_seconds: 0, max_speed_mps: null, start_address: null, end_address: null},
  ],
  ...overrides,
});

const notFound = () => {
  const config = {url: '/api/v1/dashboard/home', headers: new AxiosHeaders()} as never;
  const error = new AxiosError('Request failed with status code 404', '404', config);
  error.response = {status: 404, data: {}, statusText: '', headers: {}, config} as never;
  return error;
};

describe('homeService', () => {
  beforeEach(resetApiClientMocks);

  it('fills only what /dashboard knows and leaves the rest null', () => {
    const stats = homeFromDashboard(dashboard());
    expect(stats.total_distance_meters).toBe(12000);
    expect(stats.avg_trip_distance_meters).toBe(6000);
    expect(stats.events).toEqual({accel: 3, brake: 1});
    expect(stats.top_speed_mps).toBeNull();
    expect(stats.streak_days).toBeNull();
    expect(stats.score).toEqual({current: 88, delta: null});
  });

  it('a new user gets nulls, not zeros', () => {
    const stats = homeFromDashboard(
      dashboard({summary: {total_trips: 0, total_distance_meters: 0, total_duration_seconds: 0, avg_driving_score: null}, recent_trips: []}),
    );
    expect(stats.total_distance_meters).toBeNull();
    expect(stats.trip_count).toBeNull();
    expect(stats.events).toBeNull();
  });

  it('picks the latest ended trip as last trip', () => {
    expect(lastTripFrom(dashboard())?.id).toBe('b');
  });

  it('falls back to /dashboard when /dashboard/home is not deployed', async () => {
    mockApiGet(dashboard());
    mockedApiClient.get.mockRejectedValueOnce(notFound());
    const home = await homeService.getHome();
    expect(home.stats.total_distance_meters).toBe(12000);
    expect(home.lastTrip?.id).toBe('b');
  });

  it('uses /dashboard/home when present', async () => {
    mockApiGet(dashboard());
    mockApiGet({top_speed_mps: 30, streak_days: 4});
    const home = await homeService.getHome();
    expect(home.stats.top_speed_mps).toBe(30);
    expect(home.stats.streak_days).toBe(4);
    expect(home.stats.turns).toBeNull();
  });
});
