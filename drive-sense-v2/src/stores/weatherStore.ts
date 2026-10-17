import * as Location from 'expo-location';
import {create} from 'zustand';
import {weatherService, type Weather} from '../services/weatherService';

const CACHE_MS = 30 * 60 * 1000;

/** `loading` shows a skeleton; `hidden` (no permission, fetch failed) shows nothing. */
export type WeatherStatus = 'idle' | 'loading' | 'ready' | 'hidden';

interface WeatherState {
  weather: Weather | null;
  status: WeatherStatus;
  fetchedAt: number;
  load: () => Promise<void>;
}

/** Weather never blocks Home: denied permission or a failed fetch just hides the card. */
export const useWeatherStore = create<WeatherState>((set, get) => ({
  weather: null,
  status: 'idle',
  fetchedAt: 0,
  load: async () => {
    if (get().weather && Date.now() - get().fetchedAt < CACHE_MS) {
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
      const position =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Low}));
      const {latitude, longitude} = position.coords;
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
      set(get().weather ? {} : {weather: null, status: 'hidden'});
    }
  },
}));
