import {create} from 'zustand';
import {getApiErrorMessage} from '../services/apiClient';
import {
  tripService,
  tripUploadApi,
  type TripListParams,
  type TripListTotals,
  type TripRoutePreview,
  type TripSort,
  type TripSummary,
} from '../services/tripService';
import {getDb} from '../db';
import {deleteTrips, isInCloud, listTrips, routePreviews} from '../db/repos';
import {finishOutboxItem} from '../sync/outbox';
import {useSyncStore} from '../sync/syncStore';
import {periodRange, type Period} from '../utils/logbook';

const PAGE = 20;

export interface LogbookFilters {
  search: string;
  sort: TripSort;
  period: Period;
  vehicleId: string | null;
  minScore: number | null;
}

export const DEFAULT_FILTERS: LogbookFilters = {search: '', sort: 'newest', period: 'month', vehicleId: null, minScore: null};

interface LogbookState {
  filters: LogbookFilters;
  items: TripSummary[];
  total: number;
  totals: TripListTotals | null;
  routes: TripRoutePreview[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  loadingMore: boolean;
  error: string | null;
  selecting: boolean;
  selected: string[];
  deleting: boolean;
  /** Merges into the filters and reloads from the first page. */
  setFilters: (patch: Partial<LogbookFilters>) => Promise<void>;
  /** First page, totals and routes. Rows already shown stay until the new ones arrive. */
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  startSelect: () => void;
  stopSelect: () => void;
  toggle: (id: string) => void;
  selectAll: () => void;
  deleteSelected: () => Promise<{deleted: number; failed: number}>;
}

const query = (f: LogbookFilters): Omit<TripListParams, 'offset' | 'limit'> => ({
  sort: f.sort,
  search: f.search,
  vehicleId: f.vehicleId,
  minScore: f.minScore,
  from: periodRange(f.period)?.toISOString() ?? null,
});

/** The phone's copy, once a first sync has filled it (spec 2026-10-17, local-first part 1). */
const localDb = () => (useSyncStore.getState().ready ? getDb() : null);

/** A page of drives: from the phone when it has them, otherwise from the server. */
const listPage = async (params: TripListParams) => {
  const db = localDb();
  return db ? listTrips(db, params) : tripService.list(params);
};

/** Map lines: the phone's downloaded routes, topped up from the server while some are still missing. */
const listRoutes = async (params: Omit<TripListParams, 'offset' | 'sort'>): Promise<TripRoutePreview[]> => {
  const db = localDb();
  const local = db ? routePreviews(db, params) : null;
  if (local?.complete) {
    return local.routes;
  }
  return tripService.routes(params).catch(() => local?.routes ?? []);
};

/** Logbook: filters, paged drives with period totals, route lines for the map, and multi-select delete. */
export const useLogbookStore = create<LogbookState>((set, get) => {
  // Each load gets a number; a response for an older one is ignored (typing fast in search).
  let request = 0;

  return {
    filters: DEFAULT_FILTERS,
    items: [],
    total: 0,
    totals: null,
    routes: [],
    status: 'idle',
    loadingMore: false,
    error: null,
    selecting: false,
    selected: [],
    deleting: false,

    setFilters: async (patch) => {
      set((s) => ({filters: {...s.filters, ...patch}}));
      await get().load();
    },

    load: async () => {
      const mine = ++request;
      const q = query(get().filters);
      set({status: 'loading', error: null});
      try {
        const [page, routes] = await Promise.all([
          listPage({...q, limit: PAGE, offset: 0}),
          // The map is a bonus: a failure here must not hide the list.
          listRoutes({search: q.search, vehicleId: q.vehicleId, minScore: q.minScore, from: q.from}).catch(() => [] as TripRoutePreview[]),
        ]);
        if (mine !== request) {
          return;
        }
        set({items: page.items, total: page.total, totals: page.totals, routes, status: 'ready'});
      } catch (error) {
        if (mine === request) {
          set({status: 'error', error: getApiErrorMessage(error, 'Could not load your drives.')});
        }
      }
    },

    loadMore: async () => {
      const {items, total, loadingMore, status, filters} = get();
      if (loadingMore || status !== 'ready' || items.length >= total) {
        return;
      }
      const mine = request;
      set({loadingMore: true});
      try {
        const page = await listPage({...query(filters), limit: PAGE, offset: items.length});
        if (mine === request) {
          set((s) => ({items: [...s.items, ...page.items.filter((t) => !s.items.some((x) => x.id === t.id))], total: page.total}));
        }
      } catch {
        // The next scroll to the end tries again.
      } finally {
        set({loadingMore: false});
      }
    },

    startSelect: () => set({selecting: true, selected: []}),
    stopSelect: () => set({selecting: false, selected: []}),
    toggle: (id) => set((s) => ({selected: s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id]})),
    selectAll: () => set((s) => ({selected: s.items.map((t) => t.id)})),

    deleteSelected: async () => {
      const ids = get().selected;
      set({deleting: true});
      const failed: string[] = [];
      for (const id of ids) {
        try {
          const db = getDb();
          if (db && !isInCloud(db, id)) {
            // Not on the server (waiting to upload, or phone only): forget it on the phone.
            finishOutboxItem(db, id);
          } else {
            await tripUploadApi.remove(id);
            if (db) {
              deleteTrips(db, [id]);
            }
          }
          set((s) => ({items: s.items.filter((t) => t.id !== id), total: Math.max(0, s.total - 1)}));
        } catch {
          failed.push(id);
        }
      }
      set({deleting: false, selected: failed, selecting: failed.length > 0});
      // Totals and the route map change with the deleted drives.
      await get().load();
      return {deleted: ids.length - failed.length, failed: failed.length};
    },
  };
});

// New or changed drives arrived from a sync: refresh a Logbook that has already been opened.
useSyncStore.subscribe((next, prev) => {
  if (next.version !== prev.version && useLogbookStore.getState().status !== 'idle') {
    void useLogbookStore.getState().load();
  }
});
