import * as Location from 'expo-location';
import {create} from 'zustand';
import {getDb} from '../db';
import {lastRoutePoint} from '../db/repos';
import {weatherService, type Weather} from '../services/weatherService';

const CACHE_MS = 30 * 60 * 1000;
/** A fresh fix that takes longer than this (indoors, cold GPS) gives way to the fallbacks. */
const FIX_TIMEOUT_MS = 8000;

/**
 * `loading` shows a skeleton; `hidden` (location not allowed) shows nothing; `error` (no position
 * anywhere, or the forecast failed) shows a small card with Retry.
 */
export type WeatherStatus = 'idle' | 'loading' | 'ready' | 'hidden' | 'error';

interface WeatherState {
  weather: Weather | null;
  status: WeatherStatus;
  fetchedAt: number;
  /** `force` skips the 30-minute cache (Retry, pull to refresh). */
  load: (force?: boolean) => Promise<void>;
}

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

/**
 * Where to ask the forecast for: the last known fix, else a fresh one (bounded wait), else where
 * the last drive ended. Null when none of them exists.
 */
async function position(): Promise<{latitude: number; longitude: number} | null> {
  const last = await Location.getLastKnownPositionAsync().catch(() => null);
  if (last) {
    return last.coords;
  }
  const fresh = await withTimeout(Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Low}), FIX_TIMEOUT_MS).catch(() => null);
  if (fresh) {
    return fresh.coords;
  }
  const db = getDb();
  return db ? lastRoutePoint(db) : null;
}

/** Weather never blocks Home: it loads beside the stats, and a failure only shows a Retry card. */
export const useWeatherStore = create<WeatherState>((set, get) => ({
  weather: null,
  status: 'idle',
  fetchedAt: 0,
  load: async (force = false) => {
    if (!force && get().weather && Date.now() - get().fetchedAt < CACHE_MS) {
      return;
    }
    // A refresh keeps the card it already has; only a first load shows the skeleton.
    if (!get().weather) {
      set({status: 'loading'});
    }
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        set({weather: null, status: 'hidden'});
        return;
      }
      const coords = await position();
      if (!coords) {
        set(get().weather ? {} : {status: 'error'});
        return;
      }
      const {latitude, longitude} = coords;
      let city: string | null = null;
      try {
        const [place] = await Location.reverseGeocodeAsync({latitude, longitude});
        city = place?.city ?? place?.subregion ?? place?.region ?? null;
      } catch {
        city = null;
      }
      const weather = await weatherService.fetch(latitude, longitude, city);
      set({weather, status: 'ready', fetchedAt: Date.now()});
    } catch {
      // Keep the last forecast on screen; with none, offer Retry.
      set(get().weather ? {} : {status: 'error'});
    }
  },
}));
