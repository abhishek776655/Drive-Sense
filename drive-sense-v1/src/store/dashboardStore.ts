import {create} from 'zustand';
import {dashboardService, TransformedDashboard, TrendGranularity, TrendView} from '../services/dashboardService';
import {getApiErrorMessage} from '../services/apiClient';

interface DashboardState {
  data: TransformedDashboard | null;
  loading: boolean;
  error: string | null;
  trendGranularity: TrendGranularity;
  trendCache: Partial<Record<TrendGranularity, TrendView>>;
  trendLoading: boolean;
  trendError: string | null;
  fetchDashboard: (options?: {silent?: boolean}) => Promise<void>;
  setTrendGranularity: (granularity: TrendGranularity) => Promise<void>;
}

/**
 * Tracked outside the store so a silent poll can be deduped without flipping the visible `loading`
 * flag, which drives the pull-to-refresh spinners.
 */
let inFlightFetch: Promise<void> | null = null;

export const useDashboardStore = create<DashboardState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  trendGranularity: 'day',
  trendCache: {},
  trendLoading: false,
  trendError: null,
  setTrendGranularity: async (granularity: TrendGranularity) => {
    // Show the cached series for this range immediately; a tab tap should never blank the chart.
    const cached = get().trendCache[granularity];
    set({trendGranularity: granularity, trendError: null, trendLoading: !cached});

    try {
      const trend = await dashboardService.getTrend(granularity);
      set((state) => ({
        trendCache: {...state.trendCache, [granularity]: trend},
        // A slow response for an abandoned tab must not overwrite the range now on screen.
        trendLoading: state.trendGranularity === granularity ? false : state.trendLoading,
      }));
    } catch (error) {
      const message = getApiErrorMessage(error);
      set((state) =>
        state.trendGranularity === granularity
          ? {trendError: message, trendLoading: false}
          : {trendLoading: state.trendLoading},
      );
    }
  },
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
        // The dashboard payload already carries the daily series, so seed the cache from it and
        // spare the screen a second request for the range it opens on.
        set((state) => ({
          data,
          loading: false,
          error: null,
          trendCache: {...state.trendCache, day: data.trendView},
        }));
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
