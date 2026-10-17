import {apiClient} from './apiClient';
import {timeZone, type HomeStats} from './homeService';

export type VehicleType = 'car' | 'motorbike';
export type FuelType = 'petrol' | 'diesel' | 'cng' | 'lpg' | 'electric' | 'hybrid' | 'other';

export type Vehicle = {
  id: string;
  company_name: string;
  model_name: string;
  image_url: string | null;
  nickname: string | null;
  display_name: string;
  plate_number: string | null;
  fuel_type: FuelType;
  vehicle_type: VehicleType;
  year: number | null;
  horsepower: number | null;
  /** Versioned API path of the Garage photo (needs the auth header), or null. */
  photo_url: string | null;
};

/** What the Add / Edit sheet sends: make and model are typed, the server finds or creates them. */
export interface VehicleInput {
  vehicle_type: VehicleType;
  nickname: string | null;
  make: string;
  model: string;
  year: number | null;
  horsepower: number | null;
  fuel_type: FuelType;
}

export const vehicleService = {
  list: async (): Promise<Vehicle[]> => {
    const response = await apiClient.get<Vehicle[]>('/api/v1/vehicles');
    return response.data;
  },
  create: async (input: VehicleInput): Promise<Vehicle> => {
    const response = await apiClient.post<Vehicle>('/api/v1/vehicles', input);
    return response.data;
  },
  update: async (id: string, input: VehicleInput): Promise<Vehicle> => {
    const response = await apiClient.put<Vehicle>(`/api/v1/vehicles/${id}`, input);
    return response.data;
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/vehicles/${id}`);
  },
  /** Stores a base64 JPEG as the vehicle's photo. */
  uploadPhoto: async (id: string, data: string): Promise<Vehicle> => {
    const response = await apiClient.put<Vehicle>(`/api/v1/vehicles/${id}/photo`, {data});
    return response.data;
  },
  removePhoto: async (id: string): Promise<Vehicle> => {
    const response = await apiClient.delete<Vehicle>(`/api/v1/vehicles/${id}/photo`);
    return response.data;
  },
  /** All-time stats for one vehicle, in the Home stats shape. */
  stats: async (id: string): Promise<HomeStats> => {
    const response = await apiClient.get<HomeStats>(`/api/v1/vehicles/${id}/home-stats`, {params: {tz: timeZone()}});
    return response.data;
  },
};
