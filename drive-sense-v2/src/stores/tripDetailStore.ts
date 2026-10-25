import {isAxiosError} from 'axios';
import {create} from 'zustand';
import {getApiErrorMessage} from '../services/apiClient';
import {getDb} from '../db';
import {deleteTrips, getDetail, isInCloud, isLocalTripId, putDetail, setTripVehicle} from '../db/repos';
import {deleteTripObd} from '../db/obdRepos';
import {deleteTripSensors} from '../db/sensorRepos';
import {isPhoneOnly} from '../sync/driveBackup';
import {useVehicleStore} from './vehicleStore';
import {finishOutboxItem} from '../sync/outbox';
import {useSyncStore} from '../sync/syncStore';
import {tripDetailApi, tripUploadApi, type TripDetail} from '../services/tripService';

export type TripLoadStatus = 'loading' | 'ready' | 'error' | 'missing';

export interface TripEntry {
  status: TripLoadStatus;
  detail: TripDetail | null;
  error: string | null;
}

interface TripDetailState {
  trips: Record<string, TripEntry>;
  /** Error from the last Delete / Change vehicle, shown under the header. */
  actionError: string | null;
  busy: boolean;
  load: (id: string, opts?: {force?: boolean}) => Promise<void>;
  remove: (id: string) => Promise<boolean>;
  changeVehicle: (id: string, vehicleId: string) => Promise<boolean>;
  clearActionError: () => void;
}

const EMPTY: TripEntry = {status: 'loading', detail: null, error: null};

const isNotFound = (error: unknown) => isAxiosError(error) && error.response?.status === 404;

/** Trips opened from Logbook, cached by id so going back and forth does not refetch. */
export const useTripDetailStore = create<TripDetailState>((set, get) => {
  const put = (id: string, entry: Partial<TripEntry>) =>
    set((s) => ({trips: {...s.trips, [id]: {...(s.trips[id] ?? EMPTY), ...entry}}}));

  /** The phone's copy first (works offline); otherwise the server's, which is then kept. */
  const fetch = async (id: string, fromServer = false) => {
    const db = getDb();
    const local = db && !fromServer ? getDetail(db, id) : null;
    if (local) {
      put(id, {status: 'ready', detail: local, error: null});
      return;
    }
    try {
      const detail = await tripDetailApi.get(id);
      if (db) {
        putDetail(db, detail);
      }
      put(id, {status: 'ready', detail, error: null});
    } catch (error) {
      put(id, isNotFound(error) ? {status: 'missing', error: null} : {status: 'error', error: getApiErrorMessage(error, 'Could not load this drive.')});
    }
  };

  return {
    trips: {},
    actionError: null,
    busy: false,
    load: async (id, opts) => {
      const current = get().trips[id];
      if (!opts?.force && (current?.status === 'ready' || current?.status === 'loading')) {
        return;
      }
      // A forced reload keeps the page on screen; only a first load shows the skeleton.
      if (!current?.detail) {
        put(id, {status: 'loading', error: null});
      }
      // A forced reload (pull to refresh, changed vehicle) asks the server again.
      await fetch(id, opts?.force === true);
    },
    remove: async (id) => {
      set({busy: true, actionError: null});
      const local = getDb();
      // OBD data is keyed by start time, not id (telemetry): forget it with the trip.
      const forgetObd = () => {
        const start = get().trips[id]?.detail?.start_time;
        const db = getDb();
        if (db && start) {
          deleteTripObd(db, Date.parse(start));
          deleteTripSensors(db, Date.parse(start));
        }
      };
      // Not on the server (waiting to upload, or phone only): deleting it is forgetting it here.
      if (local && !isInCloud(local, id)) {
        forgetObd();
        finishOutboxItem(local, id);
        useSyncStore.setState((s) => ({version: s.version + 1}));
        set((s) => {
          const trips = {...s.trips};
          delete trips[id];
          return {trips, busy: false};
        });
        return true;
      }
      try {
        await tripUploadApi.remove(id);
        const db = getDb();
        if (db) {
          forgetObd();
          deleteTrips(db, [id]);
        }
        set((s) => {
          const trips = {...s.trips};
          delete trips[id];
          return {trips, busy: false};
        });
        return true;
      } catch (error) {
        set({busy: false, actionError: getApiErrorMessage(error, 'Could not delete this drive.')});
        return false;
      }
    },
    changeVehicle: async (id, vehicleId) => {
      const local = getDb();
      if (local && !isInCloud(local, id)) {
        if (isLocalTripId(id) && !isPhoneOnly()) {
          set({actionError: 'This drive is still uploading. Change its vehicle once it is online.'});
          return false;
        }
        // Phone only: the drive lives here, so the change does too.
        const vehicle = useVehicleStore.getState().vehicles.find((v) => v.id === vehicleId);
        setTripVehicle(local, id, vehicleId, vehicle?.display_name ?? '');
        useSyncStore.setState((s) => ({version: s.version + 1}));
        await fetch(id);
        return true;
      }
      set({busy: true, actionError: null});
      try {
        await tripDetailApi.updateVehicle(id, vehicleId);
        await fetch(id, true);
        set({busy: false});
        return true;
      } catch (error) {
        set({busy: false, actionError: getApiErrorMessage(error, 'Could not change the vehicle.')});
        return false;
      }
    },
    clearActionError: () => set({actionError: null}),
  };
});
