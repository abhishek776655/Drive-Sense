import {deleteTrips, deleteVehicles, metaGet, metaSet, upsertTrips, upsertVehicles, type SyncTrip} from '../db/repos';
import type {SqlDb} from '../db/sql';
import {apiClient} from '../services/apiClient';
import type {Vehicle} from '../services/vehicleService';

export const CURSOR_KEY = 'pull_cursor';
export const LAST_PULL_KEY = 'last_pull_at';
const PAGE = 200;

/** `GET /sync/pull`: everything changed after the cursor (spec 2026-10-17, local-first part 1). */
export interface SyncPage {
  vehicles: (Vehicle & {updated_at?: string})[];
  deleted_vehicles: {id: string}[];
  trips: SyncTrip[];
  deleted_trips: {id: string}[];
  cursor: string | null;
  has_more: boolean;
}

/** Writes one page into the local database (all of it or none) and moves the cursor past it. */
export const applyPage = (db: SqlDb, page: SyncPage): number => {
  db.transaction(() => {
    upsertVehicles(db, page.vehicles);
    deleteVehicles(
      db,
      page.deleted_vehicles.map((v) => v.id),
    );
    upsertTrips(db, page.trips);
    deleteTrips(
      db,
      page.deleted_trips.map((t) => t.id),
    );
    metaSet(db, CURSOR_KEY, page.cursor);
  });
  return page.vehicles.length + page.deleted_vehicles.length + page.trips.length + page.deleted_trips.length;
};

export const fetchPage = async (since: string | null): Promise<SyncPage> =>
  (await apiClient.get<SyncPage>('/api/v1/sync/pull', {params: {since: since ?? undefined, limit: PAGE}})).data;

/** Pulls every page since the stored cursor. Returns how many rows changed. Throws on network errors. */
export const pullAll = async (db: SqlDb, fetch = fetchPage, now = () => new Date()): Promise<number> => {
  let changed = 0;
  for (;;) {
    const page = await fetch(metaGet(db, CURSOR_KEY));
    changed += applyPage(db, page);
    if (!page.has_more) {
      break;
    }
  }
  metaSet(db, LAST_PULL_KEY, now().toISOString());
  return changed;
};

/** True once a first pull has completed: the local copy can be trusted for the Logbook. */
export const hasSynced = (db: SqlDb): boolean => metaGet(db, LAST_PULL_KEY) != null;
