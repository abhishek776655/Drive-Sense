import {mapTripDetailToMockTrip, tripsService, type TripDetailRead, type TripListResponse} from '../tripsService';
import {mockApiGet, mockedApiClient, resetApiClientMocks} from '../../testUtils/mockApiClient';

jest.mock('../apiClient', () => ({
  apiClient: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

const tripListResponse: TripListResponse = {
  items: [
    {
      id: 'trip-1',
      user_id: 'user-1',
      vehicle_id: 'vehicle-1',
      vehicle_name: 'Honda City',
      state: 'ended',
      start_time: '2026-05-16T10:00:00Z',
      end_time: '2026-05-16T10:30:00Z',
      distance_meters: 12000,
      duration_seconds: 1800,
      created_at: '2026-05-16T10:31:00Z',
      driving_score: 92,
      avg_speed_mps: 6.7,
      event_count: 1,
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

const tripDetail: TripDetailRead = {
  ...tripListResponse.items[0],
  vehicle_name: 'Honda City',
  max_speed_mps: 18,
  idle_time_seconds: 120,
  fuel_used_liters: 0.8,
  cost_amount: 96,
  cost_currency: 'INR',
  location_points: [
    {
      id: 1,
      trip_id: 'trip-1',
      recorded_at: '2026-05-16T10:00:00Z',
      latitude: 12.9716,
      longitude: 77.5946,
      speed_mps: 0,
      heading_deg: null,
      accuracy_m: null,
      altitude_m: null,
      is_moving: false,
      provider: 'gps',
    },
    {
      id: 2,
      trip_id: 'trip-1',
      recorded_at: '2026-05-16T10:30:00Z',
      latitude: 12.9816,
      longitude: 77.6046,
      speed_mps: 10,
      heading_deg: null,
      accuracy_m: null,
      altitude_m: null,
      is_moving: true,
      provider: 'gps',
    },
  ],
  events: [
    {
      id: 'event-1',
      trip_id: 'trip-1',
      event_type: 'overspeed',
      intensity: 1.2,
      occurred_at: '2026-05-16T10:10:00Z',
      latitude: 12.976,
      longitude: 77.599,
      payload: {
        speed_kph: 102,
        speed_mps: 28.3,
        threshold_mps: 27.78,
      },
    },
  ],
  insights: [
    {
      rule_id: 'safety_overspeed',
      category: 'safety',
      tone: 'warning',
      title: 'Overspeeding detected',
      message: 'Keep speed below posted limits to reduce risk and improve trip consistency.',
      metric_label: 'Overspeed',
      metric_value: '1 event',
      priority: 100,
    },
  ],
};

describe('tripsService', () => {
  beforeEach(() => {
    resetApiClientMocks();
  });

  it('requests trip list with backend query parameter names', async () => {
    mockApiGet(tripListResponse);

    const result = await tripsService.listTrips({
      vehicleId: 'vehicle-1',
      startTimeGte: '2026-05-01T00:00:00Z',
      minScore: 80,
    });

    expect(result).toBe(tripListResponse);
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/v1/trips', {
      params: {
        vehicle_id: 'vehicle-1',
        start_time_gte: '2026-05-01T00:00:00Z',
        start_time_lte: undefined,
        min_score: 80,
        limit: 50,
        offset: 0,
      },
    });
  });

  it('preserves backend trip insight contract data when mapping trip details', () => {
    const mappedTrip = mapTripDetailToMockTrip(tripDetail);

    expect(mappedTrip.id).toBe('trip-1');
    expect(mappedTrip.category).toBe('Honda City');
    expect(mappedTrip.events[0]).toMatchObject({
      event_type: 'overspeed',
      intensity: 1.2,
      payload: {
        speed_kph: 102,
        speed_mps: 28.3,
        threshold_mps: 27.78,
      },
    });
    expect(mappedTrip.insights).toEqual(tripDetail.insights);
  });
});
