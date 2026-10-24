import type {FuelType} from '../services/vehicleService';

/** Air-fuel ratio and fuel density (g/L) for turning air flow into fuel flow. */
const FUEL: Partial<Record<FuelType, {afr: number; gPerL: number}>> = {
  petrol: {afr: 14.7, gPerL: 745},
  hybrid: {afr: 14.7, gPerL: 745},
  other: {afr: 14.7, gPerL: 745},
  diesel: {afr: 14.5, gPerL: 832},
  lpg: {afr: 15.5, gPerL: 510},
};

/** Below this speed L/100 km is meaningless (it heads to infinity at a standstill). */
export const ECONOMY_MIN_KMH = 5;

/**
 * Fuel flow in L/h: the car's own fuel rate (PID 5E) when it has one, else worked out from air flow
 * (PID 10). Null for fuels where air flow says nothing useful (CNG, electric).
 */
export const fuelFlowLph = ({fuelRate, maf}: {fuelRate?: number | null; maf?: number | null}, fuel: FuelType): number | null => {
  if (fuelRate != null) {
    return fuelRate;
  }
  const f = FUEL[fuel];
  if (maf == null || !f) {
    return null;
  }
  return (maf / f.afr / f.gPerL) * 3600;
};

export const economyL100 = (flowLph: number | null, kmh: number | null): number | null =>
  flowLph == null || kmh == null || kmh < ECONOMY_MIN_KMH ? null : (flowLph / kmh) * 100;

/** Turbo boost in kPa (manifold above outside pressure); null when there is none to show. */
export const boostKpa = (map: number | null | undefined, baro: number | null | undefined): number | null => {
  if (map == null || baro == null) {
    return null;
  }
  const boost = map - baro;
  return boost > 1 ? boost : null;
};

/** Ratios this close (as a fraction) count as the same gear. */
const SAME_GEAR = 0.08;
/** Readings a gear needs before it is trusted. */
const MIN_SAMPLES = 20;
/** Same answer this many times running before it is shown. */
const STABLE = 3;
const MIN_KMH = 8;

/**
 * Guesses the gear from RPM ÷ speed. Each gear has its own ratio, so readings bunch into clusters
 * over a drive; the cluster with the highest ratio is 1st gear. Learns as it goes and returns null
 * until a guess has held for a few readings.
 */
export class GearEstimator {
  private clusters: {ratio: number; n: number}[] = [];
  private last: number | null = null;
  private streak = 0;

  add(rpm: number | null | undefined, kmh: number | null | undefined): number | null {
    if (rpm == null || kmh == null || kmh < MIN_KMH || rpm < 500) {
      this.last = null;
      this.streak = 0;
      return null;
    }
    const ratio = rpm / kmh;
    let cluster = this.clusters.find((c) => Math.abs(c.ratio - ratio) / c.ratio <= SAME_GEAR);
    if (cluster) {
      cluster.ratio += (ratio - cluster.ratio) / (cluster.n + 1);
      cluster.n += 1;
    } else {
      cluster = {ratio, n: 1};
      this.clusters.push(cluster);
    }
    if (cluster.n < MIN_SAMPLES) {
      this.streak = 0;
      return null;
    }
    const gears = this.clusters.filter((c) => c.n >= MIN_SAMPLES).sort((a, b) => b.ratio - a.ratio);
    const gear = gears.indexOf(cluster) + 1;
    this.streak = gear === this.last ? this.streak + 1 : 1;
    this.last = gear;
    return this.streak >= STABLE ? gear : null;
  }
}
