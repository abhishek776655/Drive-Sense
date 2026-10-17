import {deleteTrips, markRouteState, putDetail, tripsMissingRoutes} from '../db/repos';
import type {SqlDb} from '../db/sql';
import {tripDetailApi, type TripDetail} from '../services/tripService';

const isNotFound = (error: unknown) => (error as {response?: {status?: number}})?.response?.status === 404;

/**
 * Downloads the routes (points, events, insights) of drives still missing them, newest first and
 * one at a time, while `canContinue` says so (Wi-Fi, signed in, not recording). A drive the server
 * no longer has is removed; any other failure marks it failed and stops for now. Returns how many
 * routes were saved.
 */
export const backfillRoutes = async (
  db: SqlDb,
  canContinue: () => Promise<boolean> | boolean,
  fetch: (id: string) => Promise<TripDetail> = tripDetailApi.get,
  batch = 25,
): Promise<number> => {
  let saved = 0;
  for (;;) {
    const ids = tripsMissingRoutes(db, batch);
    if (ids.length === 0) {
      return saved;
    }
    for (const id of ids) {
      if (!(await canContinue())) {
        return saved;
      }
      try {
        putDetail(db, await fetch(id));
        saved += 1;
      } catch (error) {
        if (isNotFound(error)) {
          deleteTrips(db, [id]);
        } else {
          markRouteState(db, id, 'failed');
          return saved;
        }
      }
    }
  }
};
