import {apiClient} from './apiClient';
import type {MockTrip, MockTripEvent, RoutePoint} from '../mocks/trackingData';
import type {TimedRoutePoint} from '../utils/tripRoute';

export type TripRead = {
  id: string;
  user_id: string;
  vehicle_id: string;
  vehicle_name: string;
  state: 'idle' | 'started' | 'active' | 'paused' | 'ended';
  start_time: string;
  end_time: string | null;
  distance_meters: number;
  duration_seconds: number;
  created_at: string;
  driving_score: number | null;
  avg_speed_mps: number | null;
  event_count: number;
};

export type TripListResponse = {
  items: TripRead[];
  total: number;
  limit: number;
  offset: number;
};

export type TripListParams = {
  vehicleId?: string;
  startTimeGte?: string;
  startTimeLte?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
};

export type TripDetailRead = TripRead & {
  vehicle_name: string;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  idle_time_seconds: number;
  fuel_used_liters: number | null;
  cost_amount: number | null;
  cost_currency: string | null;
  driving_score: number | null;
  location_points: Array<{
    id: number;
    trip_id: string;
    recorded_at: string;
    latitude: number;
    longitude: number;
    speed_mps: number | null;
    heading_deg: number | null;
    accuracy_m: number | null;
    altitude_m: number | null;
    is_moving: boolean | null;
    provider: string | null;
  }>;
  events: Array<{
    id: string;
    trip_id: string;
    event_type: 'harsh_brake' | 'rapid_acceleration' | 'overspeed';
    intensity: number | null;
    occurred_at: string;
    latitude: number | null;
    longitude: number | null;
    payload: Record<string, unknown>;
  }>;
};

const formatDateLabel = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

const formatTimeLabel = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

const formatCoordinateLabel = (point?: {latitude: number; longitude: number} | null) =>
  point ? `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}` : 'Unknown';

const formatDistance = (meters: number) => `${(meters / 1000).toFixed(1)} km`;

const formatDuration = (seconds: number) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
};

const formatFuel = (liters: number | null) => (liters != null ? `${liters.toFixed(1)} L` : 'N/A');

const formatMileage = (meters: number, liters: number | null) => {
  if (!liters || liters <= 0) {
    return 'N/A';
  }
  return `${((meters / 1000) / liters).toFixed(1)} km/l`;
};

const mapEventPayload = (event: TripDetailRead['events'][number]): MockTripEvent => ({
  event_type: event.event_type,
  intensity: event.intensity ?? 1,
  occurred_at: event.occurred_at,
  latitude: event.latitude ?? 0,
  longitude: event.longitude ?? 0,
  payload: {
    speed_mps: typeof event.payload.speed_mps === 'number' ? event.payload.speed_mps : undefined,
    speed_kph: typeof event.payload.speed_kph === 'number' ? event.payload.speed_kph : undefined,
    previous_speed_mps:
      typeof event.payload.previous_speed_mps === 'number' ? event.payload.previous_speed_mps : undefined,
    acceleration_mps2:
      typeof event.payload.acceleration_mps2 === 'number' ? event.payload.acceleration_mps2 : undefined,
    delta_seconds: typeof event.payload.delta_seconds === 'number' ? event.payload.delta_seconds : undefined,
    threshold_mps: typeof event.payload.threshold_mps === 'number' ? event.payload.threshold_mps : undefined,
    threshold_mps2: typeof event.payload.threshold_mps2 === 'number' ? event.payload.threshold_mps2 : undefined,
  },
});

export const mapTripDetailToMockTrip = (trip: TripDetailRead): MockTrip => {
  const routePoints: TimedRoutePoint[] = trip.location_points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
    recorded_at: point.recorded_at,
  }));
  const coordinates: RoutePoint[] = routePoints.map(({latitude, longitude}) => ({latitude, longitude}));
  const startPoint = routePoints[0];
  const endPoint = routePoints[routePoints.length - 1];
  const avgSpeedKph = trip.avg_speed_mps != null ? Math.round(trip.avg_speed_mps * 3.6) : 0;
  const maxSpeedKph = trip.max_speed_mps != null ? Math.round(trip.max_speed_mps * 3.6) : 0;

  return {
    id: trip.id,
    title: startPoint ? `Start • ${formatCoordinateLabel(startPoint)}` : trip.vehicle_name,
    subtitle: endPoint ? `End • ${formatCoordinateLabel(endPoint)}` : 'Trip end unavailable',
    date: formatDateLabel(trip.start_time),
    distance: formatDistance(trip.distance_meters),
    duration: formatDuration(trip.duration_seconds),
    score: trip.driving_score ?? 0,
    coordinates,
    routePoints,
    startTime: formatTimeLabel(trip.start_time),
    endTime: trip.end_time ? formatTimeLabel(trip.end_time) : 'In Progress',
    category: trip.vehicle_name,
    status: trip.state === 'ended' ? 'Completed' : 'Active',
    avgSpeed: `${avgSpeedKph} km/h`,
    maxSpeed: `${maxSpeedKph} km/h`,
    fuelConsumed: formatFuel(trip.fuel_used_liters),
    mileage: formatMileage(trip.distance_meters, trip.fuel_used_liters),
    idleTime: formatDuration(trip.idle_time_seconds),
    stops: String(trip.events.filter((event) => event.event_type === 'harsh_brake').length),
    drivingScore: trip.driving_score ?? 0,
    events: trip.events.map(mapEventPayload),
  };
};

export const tripsService = {
  listTrips: async (params: TripListParams = {}) => {
    const response = await apiClient.get<TripListResponse>('/api/v1/trips', {
      params: {
        vehicle_id: params.vehicleId,
        start_time_gte: params.startTimeGte,
        start_time_lte: params.startTimeLte,
        min_score: params.minScore,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
      },
    });
    return response.data;
  },
  getTripDetail: async (tripId: string) => {
    const response = await apiClient.get<TripDetailRead>(`/api/v1/trips/${tripId}`);
    return response.data;
  },
};
