import {create} from 'zustand';
import {useSyncStore} from '../sync/syncStore';
import {getApiErrorMessage} from '../services/apiClient';
import {statsService, type StatsOverview, type StatsPeriod} from '../services/statsService';
import type {DayRange} from '../utils/calendar';
import {usePreferencesStore} from './preferencesStore';

interface StatsState {
  period: StatsPeriod;
  vehicleId: string | null;
  /** The days a `custom` period covers (a picked month is a custom range too). */
  range: DayRange | null;
  data: StatsOverview | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  load: () => Promise<void>;
  setFilters: (patch: {period?: StatsPeriod; vehicleId?: string | null; range?: DayRange | null}) => Promise<void>;
}

// Each load takes a number; a response that is no longer the latest is dropped, so quickly
// switching chips never shows an older period's numbers.
let latest = 0;

export const useStatsStore = create<StatsState>((set, get) => ({
  period: 'month',
  vehicleId: null,
  range: null,
  data: null,
  status: 'idle',
  error: null,
  load: async () => {
    const request = ++latest;
    set({status: 'loading', error: null});
    try {
      const {period, vehicleId, range} = get();
      const overKmh = usePreferencesStore.getState().speedAlertKmh;
      const data = await statsService.overview({period, vehicleId, range, overKmh});
      if (request === latest) {
        set({data, status: 'ready'});
      }
    } catch (error) {
      if (request === latest) {
        set({status: 'error', error: getApiErrorMessage(error, 'Could not load your stats.')});
      }
    }
  },
  setFilters: async (patch) => {
    set(patch);
    await get().load();
  },
}));

// The phone's drives changed (a sync, a drive saved offline): numbers on screen follow.
useSyncStore.subscribe((next, prev) => {
  if (next.version !== prev.version && useStatsStore.getState().status !== 'idle') {
    void useStatsStore.getState().load();
  }
});
