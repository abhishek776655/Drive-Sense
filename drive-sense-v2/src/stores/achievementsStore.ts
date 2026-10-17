import {create} from 'zustand';
import {useSyncStore} from '../sync/syncStore';
import {getApiErrorMessage} from '../services/apiClient';
import {achievementsService, type AchievementsOverview} from '../services/achievementsService';

interface AchievementsState {
  data: AchievementsOverview | null;
  error: string | null;
  load: () => Promise<void>;
}

/** Level, XP and achievements; reloaded whenever the level card or a drive summary appears. */
export const useAchievementsStore = create<AchievementsState>((set) => ({
  data: null,
  error: null,
  load: async () => {
    try {
      set({data: await achievementsService.get(), error: null});
    } catch (error) {
      set({error: getApiErrorMessage(error, 'Could not load achievements.')});
    }
  },
}));

// The phone's drives changed (a sync, a drive saved offline): the level follows.
useSyncStore.subscribe((next, prev) => {
  if (next.version !== prev.version && useAchievementsStore.getState().data != null) {
    void useAchievementsStore.getState().load();
  }
});
