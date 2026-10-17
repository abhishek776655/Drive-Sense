import {apiClient} from './apiClient';

export type TripSummary = {
  id: string;
  vehicle_name: string;
  state: 'idle' | 'started' | 'active' | 'paused' | 'ended';
  start_time: string;
  end_time: string | null;
  distance_meters: number;
  duration_seconds: number;
  driving_score: number | null;
  max_speed_mps: number | null;
  start_address: string | null;
  end_address: string | null;
  event_count: number;
  /** Saved on the phone and not uploaded yet (local-first part 2a). */
  pending?: boolean;
};

export type TripSort = 'newest' | 'oldest' | 'longest' | 'fastest' | 'best' | 'worst';

export type TripListParams = {
  limit?: number;
  offset?: number;
  sort?: TripSort;
  search?: string;
  vehicleId?: string | null;
  minScore?: number | null;
  /** ISO start of the period; null for all time. */
  from?: string | null;
};

export type TripListTotals = {count: number; distance_meters: number; duration_seconds: number; max_speed_mps: number | null};
export type TripListResult = {items: TripSummary[]; total: number; totals: TripListTotals};
export type TripRoutePreview = {
  trip_id: string;
  start_time: string;
  distance_meters: number;
  duration_seconds: number;
  max_speed_mps: number | null;
  start_address: string | null;
  end_address: string | null;
  points: [number, number][];
};

const toQuery = (p: TripListParams) => ({
  limit: p.limit,
  offset: p.offset,
  sort: p.sort,
  search: p.search?.trim() || undefined,
  vehicle_id: p.vehicleId ?? undefined,
  min_score: p.minScore ?? undefined,
  start_time_gte: p.from ?? undefined,
});

export const tripService = {
  list: async (p: TripListParams = {}): Promise<TripListResult> => {
    const {data} = await apiClient.get<Partial<TripListResult> & {items: TripSummary[]; total: number}>('/api/v1/trips', {
      params: toQuery({limit: 20, offset: 0, ...p}),
    });
    // An older server has no totals: count what came back so the page still renders.
    return {items: data.items, total: data.total, totals: data.totals ?? {count: data.total, distance_meters: 0, duration_seconds: 0, max_speed_mps: null}};
  },
  /** Route lines for the Logbook map (newest first, thinned). */
  routes: async (p: Omit<TripListParams, 'offset' | 'sort'> = {}): Promise<TripRoutePreview[]> =>
    (await apiClient.get<TripRoutePreview[]>('/api/v1/trips/routes', {params: toQuery({limit: 30, ...p})})).data,
};

type TripRead = {id: string; driving_score: number | null};

export type LocationPointPayload = {
  recorded_at: string;
  latitude: number;
  longitude: number;
  speed_mps: number | null;
  heading_deg: number | null;
  accuracy_m: number | null;
  altitude_m: number | null;
  peak_g: number | null;
};

export type TripFinishPayload = {
  end_time: string;
  distance_meters: number;
  duration_seconds: number;
  idle_time_seconds: number;
  driving_score: number;
  max_g_force: number | null;
  max_g_source: 'sensor' | 'gps' | null;
  left_turns: number;
  right_turns: number;
  events: {event_type: string; intensity: number; occurred_at: string; latitude: number; longitude: number}[];
};

export const tripUploadApi = {
  start: async (vehicleId: string, startTime: string) =>
    (await apiClient.post<TripRead>('/api/v1/trips/start', {vehicle_id: vehicleId, start_time: startTime})).data,
  /** Server-side event detection is on, so harsh brakes etc. come from the uploaded points. */
  locations: async (tripId: string, points: LocationPointPayload[]) =>
    (await apiClient.post(`/api/v1/trips/${tripId}/locations`, points, {params: {detect_events: true}})).data,
  end: async (payload: {vehicle_id: string; end_time: string; distance_meters: number; duration_seconds: number}) =>
    (await apiClient.post<TripRead>('/api/v1/trips/end', payload)).data,
  /** Ends the drive with the phone's own numbers and events (local-first part 2b). */
  finish: async (tripId: string, payload: TripFinishPayload) => (await apiClient.post<TripRead>(`/api/v1/trips/${tripId}/finish`, payload)).data,
  /** Discard: soft-deletes the trip server-side. */
  remove: async (tripId: string) => {
    await apiClient.delete(`/api/v1/trips/${tripId}`);
  },
};

export type TripEventKind = 'rapid_acceleration' | 'harsh_brake' | 'overspeed';

export type TripEvent = {
  id: string;
  event_type: TripEventKind | string;
  intensity: number | null;
  occurred_at: string;
  latitude: number | null;
  longitude: number | null;
};

export type TripPoint = {
  recorded_at: string;
  latitude: number;
  longitude: number;
  speed_mps: number | null;
  altitude_m: number | null;
  /** GPS fix accuracy (m), when the phone reported it. */
  accuracy_m?: number | null;
  /** Phone accelerometer peak (G, gravity removed) since the previous point, when sensors ran. */
  peak_g?: number | null;
};

export type TripInsight = {rule_id: string; tone: 'info' | 'success' | 'warning' | string; title: string; message: string};

/** The parts of `GET /trips/{id}` the app uses. */
export type TripDetail = {
  id: string;
  vehicle_id: string;
  vehicle_name: string;
  start_time: string;
  end_time: string | null;
  distance_meters: number;
  duration_seconds: number;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  driving_score: number | null;
  idle_time_seconds: number;
  fuel_used_liters: number | null;
  max_g_force: number | null;
  /** 'sensor' or 'gps' (estimated from speed changes). */
  max_g_source: string | null;
  left_turns: number | null;
  right_turns: number | null;
  start_address: string | null;
  end_address: string | null;
  location_points: TripPoint[];
  events: TripEvent[];
  insights: TripInsight[];
};

export const tripDetailApi = {
  get: async (tripId: string): Promise<TripDetail> => (await apiClient.get<TripDetail>(`/api/v1/trips/${tripId}`)).data,
  /** Move the trip to another of the user's vehicles. */
  updateVehicle: async (tripId: string, vehicleId: string): Promise<void> => {
    await apiClient.patch(`/api/v1/trips/${tripId}`, {vehicle_id: vehicleId});
  },
};
