import {apiClient} from './apiClient';

type TripRead = {
  id: string;
  user_id: string;
  vehicle_id: string;
  state: string;
  start_time: string;
  end_time: string | null;
  distance_meters: number;
  duration_seconds: number;
  created_at: string;
};

type LocationPointCreate = {
  recorded_at: string;
  latitude: number;
  longitude: number;
  speed_mps?: number | null;
  heading_deg?: number | null;
  accuracy_m?: number | null;
  altitude_m?: number | null;
  is_moving?: boolean | null;
  provider?: string | null;
};

type EventCreate = {
  trip_id?: string;
  event_type: string;
  intensity?: number | null;
  occurred_at: string;
  latitude?: number | null;
  longitude?: number | null;
  payload: Record<string, unknown>;
};

type LocationIngestResponse = {
  trip_id: string;
  accepted_points: number;
};

type EventIngestResponse = {
  trip_id: string;
  accepted_events: number;
};

type TripEndPayload = {
  vehicle_id: string;
  end_time?: string | null;
  distance_meters?: number | null;
  duration_seconds?: number | null;
};

export const tripService = {
  startTrip: async (vehicleId: string, startTime: string) => {
    const response = await apiClient.post<TripRead>('/api/v1/trips/start', {
      vehicle_id: vehicleId,
      start_time: startTime,
    });
    return response.data;
  },
  sendLocations: async (tripId: string, points: LocationPointCreate[], detectEvents = true) => {
    const response = await apiClient.post<LocationIngestResponse>(
      `/api/v1/trips/${tripId}/locations?detect_events=${detectEvents ? 'true' : 'false'}`,
      points,
    );
    return response.data;
  },
  sendEvents: async (tripId: string, events: EventCreate[]) => {
    const payload = events.map((event) => ({
      ...event,
      trip_id: tripId,
    }));
    const response = await apiClient.post<EventIngestResponse>(`/api/v1/trips/${tripId}/events`, payload);
    return response.data;
  },
  endTrip: async (payload: TripEndPayload) => {
    const response = await apiClient.post<TripRead>('/api/v1/trips/end', payload);
    return response.data;
  },
};
