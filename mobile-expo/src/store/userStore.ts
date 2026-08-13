import {create} from 'zustand';
import {authService, getApiErrorMessage} from '../services/apiClient';

export type CurrentUser = {
  id: string;
  email: string;
  created_at: string;
};

interface UserState {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  /** Fetches the signed-in user once. Repeat calls are no-ops unless `force` is set. */
  fetchCurrentUser: (options?: {force?: boolean}) => Promise<void>;
  clear: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  loading: false,
  error: null,
  fetchCurrentUser: async (options) => {
    if (get().loading) {
      return;
    }
    if (get().user && !options?.force) {
      return;
    }
    set({loading: true, error: null});
    try {
      const user = (await authService.me()) as CurrentUser;
      set({user, loading: false});
    } catch (error) {
      set({user: null, loading: false, error: getApiErrorMessage(error)});
    }
  },
  clear: () => set({user: null, loading: false, error: null}),
}));
