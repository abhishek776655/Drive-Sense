import {useMemo} from 'react';
import {getDb} from '../db';
import {carDrives} from '../db/obdRepos';
import {rangeEconomy, rangeKm} from '../obd/fuel';
import {usePreferencesStore} from '../stores/preferencesStore';
import {useSyncStore} from '../sync/syncStore';

/**
 * Range left for a vehicle at the given fuel level (spec 2026-10-25, telemetry sources, section 2),
 * with its tank size from Settings and its recent economy. Null when any piece is missing.
 */
export function useRange(vehicleId: string | null, fuelLevelPct: number | null | undefined): {km: number | null; tankLitres: number | null; economy: number | null} {
  const tankLitres = usePreferencesStore((s) => (vehicleId ? (s.tankLitres[vehicleId] ?? null) : null));
  const version = useSyncStore((s) => s.version);
  const economy = useMemo(() => {
    const db = getDb();
    if (!db || !vehicleId) {
      return null;
    }
    try {
      return rangeEconomy(carDrives(db), vehicleId);
    } catch {
      return null;
    }
    // `version` is the signal that the drives underneath changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, version]);
  return {km: rangeKm(fuelLevelPct, tankLitres, economy), tankLitres, economy};
}
