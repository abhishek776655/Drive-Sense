import type {CarDrive} from './carStats';

/**
 * A vehicle's fuel since `dayStartMs` (local midnight): today's saved drives plus the one recording
 * now. Economy is total fuel over total distance (a drive's distance is its fuel over its L/100 km).
 */
export const todayFuel = (
  drives: CarDrive[],
  vehicleId: string,
  dayStartMs: number,
  live: {fuelUsedL: number | null; l100km: number | null} | null,
): {fuelL: number; l100km: number | null} | null => {
  const parts = drives
    .filter((d) => d.vehicleId === vehicleId && d.startMs >= dayStartMs)
    .map((d) => ({fuelL: d.stats.fuelUsedL, l100km: d.stats.avgL100km}));
  if (live) {
    parts.push({fuelL: live.fuelUsedL, l100km: live.l100km});
  }
  let fuel = 0;
  let economyFuel = 0;
  let km = 0;
  let any = false;
  for (const p of parts) {
    if (p.fuelL == null) {
      continue;
    }
    any = true;
    fuel += p.fuelL;
    if (p.l100km != null && p.l100km > 0) {
      economyFuel += p.fuelL;
      km += (p.fuelL / p.l100km) * 100;
    }
  }
  return any ? {fuelL: fuel, l100km: km > 0 ? (economyFuel / km) * 100 : null} : null;
};
