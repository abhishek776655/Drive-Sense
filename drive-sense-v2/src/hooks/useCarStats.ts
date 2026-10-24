import {useMemo} from 'react';
import {getDb} from '../db';
import {carDrives} from '../db/obdRepos';
import type {StatsPeriod} from '../services/statsService';
import {carDrivesIn, carTotals, type CarTotals} from '../stats/carStats';
import {useSyncStore} from '../sync/syncStore';
import type {DayRange} from '../utils/calendar';

/**
 * Car (OBD-II) totals for a stats period, worked out on the phone: OBD data never leaves it, so
 * there is no server answer to wait for. Recomputed whenever the phone's drives change.
 */
export function useCarStats({period, range = null, vehicleId = null}: {period: StatsPeriod; range?: DayRange | null; vehicleId?: string | null}): CarTotals | null {
  const version = useSyncStore((s) => s.version);
  return useMemo(() => {
    const db = getDb();
    if (!db) {
      return null;
    }
    try {
      return carTotals(carDrivesIn(carDrives(db), {period, range, vehicleId}));
    } catch (error) {
      console.warn('Could not read car stats', error);
      return null;
    }
    // `version` is the signal that the drives underneath changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, range, vehicleId, version]);
}
