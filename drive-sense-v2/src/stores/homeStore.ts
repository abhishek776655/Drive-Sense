import {create} from 'zustand';
import {useSyncStore} from '../sync/syncStore';
import {getApiErrorMessage} from '../services/apiClient';
import {homeService, type HomeStats, type LastTrip, type TrendDay} from '../services/homeService';

interface HomeState {
  stats: HomeStats | null;
  lastTrip: LastTrip | null;
  trend: TrendDay[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

/** A failed refresh keeps the last data on screen and only sets `error` for an inline retry. */
export const useHomeStore = create<HomeState>((set) => ({
  stats: null,
  lastTrip: null,
  trend: [],
  loading: false,
  error: null,
  load: async () => {
    set({loading: true, error: null});
    try {
      const [home, trend] = await Promise.all([homeService.getHome(), homeService.getTrend().catch(() => [])]);
      set({stats: home.stats, lastTrip: home.lastTrip, trend, loading: false});
    } catch (error) {
      set({loading: false, error: getApiErrorMessage(error, 'Could not load your stats.')});
    }
  },
}));

// The phone's drives changed (a sync, a drive saved offline): numbers on screen follow.
useSyncStore.subscribe((next, prev) => {
  if (next.version !== prev.version && useHomeStore.getState().stats != null) {
    void useHomeStore.getState().load();
  }
});
