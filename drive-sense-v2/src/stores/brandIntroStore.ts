import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';

const KEY = 'brand_intro_seen_v1';

interface BrandIntroState {
  hydrated: boolean;
  /** True once the first-launch brand intro has played (or was skipped). */
  seen: boolean;
  hydrate: () => Promise<void>;
  markSeen: () => void;
}

/** Gates the animated brand intro to the very first launch (spec 2026-10-17, brand logo). */
export const useBrandIntroStore = create<BrandIntroState>((set) => ({
  hydrated: false,
  seen: false,
  hydrate: async () => {
    try {
      set({seen: (await AsyncStorage.getItem(KEY)) === '1', hydrated: true});
    } catch {
      // Unreadable storage only means the intro plays again; never block start-up on it.
      set({hydrated: true});
    }
  },
  markSeen: () => {
    set({seen: true});
    AsyncStorage.setItem(KEY, '1').catch(() => undefined);
  },
}));
