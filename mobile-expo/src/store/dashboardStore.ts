import {create} from 'zustand';
import {dashboardService, TransformedDashboard} from '../services/dashboardService';
import {getApiErrorMessage} from '../services/apiClient';

interface DashboardState {
  data: TransformedDashboard | null;
  loading: boolean;
  error: string | null;
  fetchDashboard: (options?: {silent?: boolean}) => Promise<void>;
}

/**
 * Tracked outside the store so a silent poll can be deduped without flipping the visible `loading`
 * flag, which drives the pull-to-refresh spinners.
 */
let inFlightFetch: Promise<void> | null = null;

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  loading: false,
  error: null,
  fetchDashboard: async (options?: {silent?: boolean}) => {
    // Several screens plus the sidebar ask for this on mount, so a cold start would otherwise fire
    // duplicate concurrent requests for the same payload.
    if (inFlightFetch) {
      return inFlightFetch;
    }

    if (!options?.silent) {
      set({loading: true, error: null});
    }

    inFlightFetch = (async () => {
      try {
        const data = await dashboardService.getDashboard();
        set({data, loading: false, error: null});
      } catch (error) {
        const message = getApiErrorMessage(error);
        if (!options?.silent) {
          set({error: message, loading: false});
        }
      } finally {
        inFlightFetch = null;
      }
    })();

    return inFlightFetch;
  },
}));
