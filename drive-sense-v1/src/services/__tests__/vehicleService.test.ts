import {vehicleService} from '../vehicleService';
import {mockApiGet, mockedApiClient, resetApiClientMocks} from '../../testUtils/mockApiClient';

jest.mock('../apiClient', () => ({
  apiClient: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

const statsResponse = {
  summary: {
    vehicle_id: 'vehicle-1',
    vehicle_name: 'Honda City',
    vehicle_image_url: null,
    fuel_type: 'petrol' as const,
    trip_count: 4,
    active_trip_count: 0,
    total_distance_meters: 40000,
    total_duration_seconds: 7200,
    total_fuel_used_liters: 3.2,
    total_fuel_cost_amount: 420,
    avg_driving_score: 88,
    last_trip_at: '2026-05-16T10:00:00Z',
  },
  trip_trend: [],
  fuel_trend: [],
  events: {harsh_brake_count: 0, rapid_acceleration_count: 0, overspeed_count: 0, total_events: 0},
  recent_trips: [],
};

describe('vehicleService.getVehicleStats', () => {
  beforeEach(() => {
    resetApiClientMocks();
  });

  it('defaults granularity to day', async () => {
    mockApiGet(statsResponse);

    await vehicleService.getVehicleStats('vehicle-1');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/vehicles/vehicle-1/stats', {
      params: {granularity: 'day'},
    });
  });

  it('passes through an explicit granularity', async () => {
    mockApiGet(statsResponse);

    await vehicleService.getVehicleStats('vehicle-1', 'month');

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/vehicles/vehicle-1/stats', {
      params: {granularity: 'month'},
    });
  });
});
