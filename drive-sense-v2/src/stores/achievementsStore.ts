import {create} from 'zustand';
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
