import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {getApiErrorMessage} from '../services/apiClient';
import type {HomeStats} from '../services/homeService';
import {getDb} from '../db';
import {deleteVehicles, listVehicles, replaceVehicles, upsertVehicles} from '../db/repos';
import {vehicleService, type Vehicle, type VehicleInput} from '../services/vehicleService';

const ACTIVE_VEHICLE_KEY = 'active_vehicle_id';

/** Mirrors a server change into the phone's copy. */
const keepLocal = (vehicles: Vehicle[]) => {
  const db = getDb();
  if (db) {
    upsertVehicles(db, vehicles);
  }
};

interface VehicleState {
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  loading: boolean;
  error: string | null;
  /** Garage stats per vehicle id, kept so switching back and forth does not flash dashes. */
  stats: Record<string, HomeStats>;
  load: () => Promise<void>;
  setActive: (vehicleId: string) => Promise<void>;
  loadStats: (vehicleId: string) => Promise<void>;
  /** Adds a vehicle and makes it the active one. Throws the API error message on failure. */
  create: (input: VehicleInput) => Promise<Vehicle>;
  update: (vehicleId: string, input: VehicleInput) => Promise<Vehicle>;
  remove: (vehicleId: string) => Promise<void>;
  /** Base64 JPEG, or null to remove the photo. Throws the API error message on failure. */
  setPhoto: (vehicleId: string, data: string | null) => Promise<void>;
}

export const useVehicleStore = create<VehicleState>((set, get) => ({
  vehicles: [],
  activeVehicleId: null,
  loading: false,
  error: null,
  stats: {},
  load: async () => {
    set({loading: true, error: null});
    const db = getDb();
    const stored = await AsyncStorage.getItem(ACTIVE_VEHICLE_KEY);
    // The Garage lists vehicles in the order they were added, online or off.
    const byAdded = (list: Vehicle[]) =>
      [...list].sort((a, b) => ((a as Vehicle & {created_at?: string}).created_at ?? '').localeCompare((b as Vehicle & {created_at?: string}).created_at ?? ''));
    const show = (unsorted: Vehicle[]) => {
      const vehicles = byAdded(unsorted);
      set({vehicles, activeVehicleId: vehicles.some((v) => v.id === stored) ? stored : (vehicles[0]?.id ?? null), loading: false});
    };
    try {
      const vehicles = await vehicleService.list();
      if (db) {
        replaceVehicles(db, vehicles);
      }
      show(vehicles);
    } catch (error) {
      // Offline: the phone's copy (spec 2026-10-17, local-first part 1).
      const local = db ? listVehicles(db) : [];
      if (local.length > 0) {
        show(local);
      } else {
        set({loading: false, error: getApiErrorMessage(error, 'Could not load your vehicles.')});
      }
    }
  },
  setActive: async (vehicleId) => {
    set({activeVehicleId: vehicleId});
    await AsyncStorage.setItem(ACTIVE_VEHICLE_KEY, vehicleId);
  },
  loadStats: async (vehicleId) => {
    try {
      const stats = await vehicleService.stats(vehicleId);
      set((state) => ({stats: {...state.stats, [vehicleId]: stats}}));
    } catch {
      // Stats are decoration on the Garage; the tiles keep showing dashes.
    }
  },
  create: async (input) => {
    try {
      const vehicle = await vehicleService.create(input);
      keepLocal([vehicle]);
      set((state) => ({vehicles: [...state.vehicles, vehicle]}));
      await get().setActive(vehicle.id);
      return vehicle;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Could not add the vehicle.'));
    }
  },
  update: async (vehicleId, input) => {
    try {
      const vehicle = await vehicleService.update(vehicleId, input);
      keepLocal([vehicle]);
      set((state) => ({vehicles: state.vehicles.map((v) => (v.id === vehicleId ? vehicle : v))}));
      return vehicle;
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Could not save the vehicle.'));
    }
  },
  setPhoto: async (vehicleId, data) => {
    try {
      const vehicle = data ? await vehicleService.uploadPhoto(vehicleId, data) : await vehicleService.removePhoto(vehicleId);
      set((state) => ({vehicles: state.vehicles.map((v) => (v.id === vehicleId ? vehicle : v))}));
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Could not save the photo.'));
    }
  },
  remove: async (vehicleId) => {
    try {
      await vehicleService.remove(vehicleId);
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'Could not delete the vehicle.'));
    }
    const db = getDb();
    if (db) {
      deleteVehicles(db, [vehicleId]);
    }
    const vehicles = get().vehicles.filter((v) => v.id !== vehicleId);
    const {[vehicleId]: _gone, ...stats} = get().stats;
    set({vehicles, stats});
    if (get().activeVehicleId === vehicleId) {
      const next = vehicles[0]?.id ?? null;
      if (next) {
        await get().setActive(next);
      } else {
        set({activeVehicleId: null});
        await AsyncStorage.removeItem(ACTIVE_VEHICLE_KEY);
      }
    }
  },
}));

export const useActiveVehicle = () =>
  useVehicleStore((state) => state.vehicles.find((v) => v.id === state.activeVehicleId) ?? null);
