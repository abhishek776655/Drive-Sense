import {create} from 'zustand';
import {dashboardService, TransformedDashboard} from '../services/dashboardService';
import {getApiErrorMessage} from '../services/apiClient';

interface DashboardState {
  data: TransformedDashboard | null;
  loading: boolean;
  error: string | null;
  fetchDashboard: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  loading: false,
  error: null,
  fetchDashboard: async () => {
    set({loading: true, error: null});
    try {
      const data = await dashboardService.getDashboard();
      set({data, loading: false});
    } catch (error) {
      const message = getApiErrorMessage(error);
      set({error: message, loading: false});
    }
  },
}));
