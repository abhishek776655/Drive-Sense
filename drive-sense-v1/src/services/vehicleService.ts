import {apiClient} from './apiClient';

export type VehicleFuelType =
  | 'petrol'
  | 'diesel'
  | 'cng'
  | 'lpg'
  | 'electric'
  | 'hybrid'
  | 'other';

export type VehicleRead = {
  id: string;
  user_id: string;
  model_id: string;
  company_name: string;
  model_name: string;
  image_url: string | null;
  nickname: string | null;
  display_name: string;
  plate_number: string | null;
  fuel_type: VehicleFuelType;
  tank_capacity_liters: number | null;
  mileage_baseline_km_per_l: number | null;
  created_at: string;
};

export type VehicleUpdatePayload = {
  model_id?: string;
  nickname?: string | null;
  plate_number?: string | null;
  fuel_type?: VehicleFuelType;
  tank_capacity_liters?: number | null;
  mileage_baseline_km_per_l?: number | null;
};

export type VehicleStatsRead = {
  summary: {
    vehicle_id: string;
    vehicle_name: string;
    vehicle_image_url: string | null;
    fuel_type: VehicleFuelType;
    trip_count: number;
    active_trip_count: number;
    total_distance_meters: number;
    total_duration_seconds: number;
    total_fuel_used_liters: number;
    total_fuel_cost_amount: number;
    avg_driving_score: number | null;
    last_trip_at: string | null;
  };
  trip_trend: Array<{
    bucket_start: string;
    trip_count: number;
    distance_meters: number;
    fuel_used_liters: number;
    fuel_cost_amount: number;
    avg_driving_score: number | null;
  }>;
  fuel_trend: Array<{
    bucket_start: string;
    trip_count: number;
    distance_meters: number;
    fuel_used_liters: number;
    fuel_cost_amount: number;
    avg_driving_score: number | null;
  }>;
  events: {
    harsh_brake_count: number;
    rapid_acceleration_count: number;
    overspeed_count: number;
    total_events: number;
  };
  recent_trips: Array<{
    trip_id: string;
    vehicle_id: string;
    vehicle_name: string;
    vehicle_image_url: string | null;
    state: string;
    start_time: string;
    end_time: string | null;
    distance_meters: number;
    duration_seconds: number;
    driving_score: number | null;
    event_count: number;
  }>;
};

export const vehicleService = {
  listVehicles: async () => {
    const response = await apiClient.get<VehicleRead[]>('/api/v1/vehicles');
    return response.data;
  },
  getVehicleStats: async (vehicleId: string, granularity: 'day' | 'week' | 'month' = 'day') => {
    const response = await apiClient.get<VehicleStatsRead>(`/api/v1/vehicles/${vehicleId}/stats`, {
      params: {granularity},
    });
    return response.data;
  },
  createVehicle: async (payload: {
    model_id: string;
    nickname?: string | null;
    plate_number?: string | null;
    fuel_type: VehicleFuelType;
    tank_capacity_liters?: number | null;
    mileage_baseline_km_per_l?: number | null;
  }) => {
    const response = await apiClient.post<VehicleRead>('/api/v1/vehicles', payload);
    return response.data;
  },
  updateVehicle: async (vehicleId: string, payload: VehicleUpdatePayload) => {
    const response = await apiClient.put<VehicleRead>(`/api/v1/vehicles/${vehicleId}`, payload);
    return response.data;
  },
  archiveVehicle: async (vehicleId: string) => {
    await apiClient.delete(`/api/v1/vehicles/${vehicleId}`);
  },
};
