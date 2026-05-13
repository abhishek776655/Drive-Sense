import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';

const ACTIVE_VEHICLE_KEY = 'active_vehicle_id';

interface VehiclePreferencesState {
  activeVehicleId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setActiveVehicleId: (vehicleId: string | null) => Promise<void>;
}

export const useVehiclePreferencesStore = create<VehiclePreferencesState>((set) => ({
  activeVehicleId: null,
  hydrated: false,
  hydrate: async () => {
    const activeVehicleId = await AsyncStorage.getItem(ACTIVE_VEHICLE_KEY);
    set({activeVehicleId, hydrated: true});
  },
  setActiveVehicleId: async (vehicleId) => {
    if (vehicleId) {
      await AsyncStorage.setItem(ACTIVE_VEHICLE_KEY, vehicleId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_VEHICLE_KEY);
    }
    set({activeVehicleId: vehicleId, hydrated: true});
  },
}));
