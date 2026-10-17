import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import type {AppearancePreference} from './theme';

const APPEARANCE_KEY = 'appearance_preference';
const VALID: AppearancePreference[] = ['system', 'light', 'dark'];

interface AppearanceState {
  preference: AppearancePreference;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPreference: (preference: AppearancePreference) => Promise<void>;
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  preference: 'system',
  hydrated: false,
  hydrate: async () => {
    const stored = await AsyncStorage.getItem(APPEARANCE_KEY);
    const preference = VALID.includes(stored as AppearancePreference) ? (stored as AppearancePreference) : 'system';
    set({preference, hydrated: true});
  },
  setPreference: async (preference) => {
    set({preference});
    await AsyncStorage.setItem(APPEARANCE_KEY, preference);
  },
}));
