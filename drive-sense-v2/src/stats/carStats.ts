import type {ObdStats} from '../obd/series';
import type {StatsPeriod} from '../services/statsService';
import type {DayRange} from '../utils/calendar';
import {addDays, dayKey, midnightOf} from './days';
import {periodStartDay} from './overview';

/** One drive that has OBD-II data (spec 2026-10-25, telemetry), as the stats see it. */
export interface CarDrive {
  startMs: number;
  vehicleId: string;
  durationS: number;
  stats: ObdStats;
}

/** Car numbers over a set of drives; null fields mean no drive reported that value. */
export interface CarTotals {
  drives: number;
  fuelL: number | null;
  avgL100km: number | null;
  avgRpm: number | null;
  maxRpm: number | null;
  maxCoolantC: number | null;
  idleS: number;
  /** Best (lowest) single-drive L/100 km. */
  bestL100km: number | null;
  /** Fuel burned idling, over the drives that measured it. */
  idleFuelL: number | null;
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/**
 * Totals across drives. Economy is total fuel over total distance (not an average of averages, so a
 * short crawl doesn't count as much as a long run), and RPM is weighted by time with car data.
 */
export const carTotals = (drives: CarDrive[]): CarTotals | null => {
  if (drives.length === 0) {
    return null;
  }
  let fuel = 0;
  let hasFuel = false;
  let economyFuel = 0;
  let economyKm = 0;
  let rpmWeighted = 0;
  let rpmWeight = 0;
  let maxRpm: number | null = null;
  let maxCoolant: number | null = null;
  let idle = 0;
  let best: number | null = null;
  let idleFuel: number | null = null;
  for (const {stats, durationS} of drives) {
    if (stats.idleFuelL != null) {
      idleFuel = (idleFuel ?? 0) + stats.idleFuelL;
    }
    if (stats.fuelUsedL != null) {
      fuel += stats.fuelUsedL;
      hasFuel = true;
      if (stats.avgL100km != null && stats.avgL100km > 0) {
        economyFuel += stats.fuelUsedL;
        economyKm += (stats.fuelUsedL / stats.avgL100km) * 100;
        best = best == null ? stats.avgL100km : Math.min(best, stats.avgL100km);
      }
    }
    if (stats.avgRpm != null) {
      const weight = Math.max(1, durationS * stats.coverage);
      rpmWeighted += stats.avgRpm * weight;
      rpmWeight += weight;
    }
    if (stats.maxRpm != null) {
      maxRpm = Math.max(maxRpm ?? 0, stats.maxRpm);
    }
    if (stats.maxCoolantC != null) {
      maxCoolant = Math.max(maxCoolant ?? -Infinity, stats.maxCoolantC);
    }
    idle += stats.idleS;
  }
  return {
    drives: drives.length,
    fuelL: hasFuel ? round(fuel, 2) : null,
    avgL100km: economyKm > 0 ? round((economyFuel / economyKm) * 100, 1) : null,
    avgRpm: rpmWeight > 0 ? Math.round(rpmWeighted / rpmWeight) : null,
    maxRpm,
    maxCoolantC: maxCoolant,
    idleS: idle,
    bestL100km: best,
    idleFuelL: idleFuel == null ? null : round(idleFuel, 2),
  };
};

/** The drives in a stats period, the same window the overview uses (local days). */
export const carDrivesIn = (
  drives: CarDrive[],
  {period, range = null, vehicleId = null, now = new Date()}: {period: StatsPeriod; range?: DayRange | null; vehicleId?: string | null; now?: Date},
): CarDrive[] => {
  const custom = period === 'custom' && range ? range : null;
  const sinceDay = custom ? custom.start : periodStartDay(period, dayKey(now));
  const since = sinceDay ? midnightOf(sinceDay).getTime() : null;
  const until = custom ? midnightOf(addDays(custom.end, 1)).getTime() : null;
  return drives.filter((d) => (since == null || d.startMs >= since) && (until == null || d.startMs < until) && (vehicleId == null || d.vehicleId === vehicleId));
};
