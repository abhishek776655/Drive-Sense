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
 * Fuel flow in L/h: the car's own fuel rate (PID 5E, L/h, or 9D, g/s) when it has one, else worked
 * out from air flow (PID 10). Null for fuels where neither says anything useful (CNG, electric).
 */
export const fuelFlowLph = (
  {fuelRate, fuelRateGs, maf}: {fuelRate?: number | null; fuelRateGs?: number | null; maf?: number | null},
  fuel: FuelType,
): number | null => {
  if (fuelRate != null) {
    return fuelRate;
  }
  const f = FUEL[fuel];
  if (!f) {
    return null;
  }
  if (fuelRateGs != null) {
    return (fuelRateGs * 3600) / f.gPerL;
  }
  return maf == null ? null : (maf / f.afr / f.gPerL) * 3600;
};

export const economyL100 = (flowLph: number | null, kmh: number | null): number | null =>
  flowLph == null || kmh == null || kmh < ECONOMY_MIN_KMH ? null : (flowLph / kmh) * 100;

/** Engine torque in Nm: the car's actual torque (% of its reference, PID 62) × the reference (PID 63). */
export const torqueNm = (pct: number | null | undefined, refNm: number | null | undefined): number | null =>
  pct == null || refNm == null ? null : (pct / 100) * refNm;

/** Power in kW from torque and RPM (P = T × ω). */
export const powerKw = (nm: number | null | undefined, rpm: number | null | undefined): number | null =>
  nm == null || rpm == null ? null : (nm * rpm * 2 * Math.PI) / 60 / 1000;

/**
 * The gear to show: the car's own (PID A4) when it names one; neutral at a standstill; otherwise the
 * RPM ÷ speed estimate. A 0 from the car while moving is neutral once the car has shown it reports
 * real gears (`carGearsSeen`); before that it may just be a car that always sends 0, so it is
 * ignored. `estimate` is only called when it is used: it feeds the estimator.
 */
export const chooseGear = (carGear: number | null | undefined, speedKmh: number | null | undefined, estimate: () => number | null, carGearsSeen = false): number | null => {
  if (carGear != null && carGear >= 1) {
    return carGear;
  }
  if (speedKmh === 0 || (carGear === 0 && carGearsSeen)) {
    return 0;
  }
  return estimate();
};

/** Speed readings this far back count toward acceleration (km/h steps are too coarse for two readings). */
const ACCEL_WINDOW_MS = 1000;
const ACCEL_MIN_SPAN_MS = 800;
const ACCEL_MAX_GAP_MS = 3000;

/** Acceleration in m/s² from the adapter's speed: the slope over the last second of readings. */
export class AccelEstimator {
  private points: {t: number; v: number}[] = [];

  add(kmh: number, at: number): number | null {
    const last = this.points[this.points.length - 1];
    if (last && at - last.t > ACCEL_MAX_GAP_MS) {
      this.points = [];
    }
    this.points = [...this.points.filter((p) => at - p.t <= ACCEL_WINDOW_MS), {t: at, v: kmh / 3.6}];
    const n = this.points.length;
    if (n < 3 || at - this.points[0].t < ACCEL_MIN_SPAN_MS) {
      return null;
    }
    // Least-squares slope, so one rounded reading can't swing it.
    const mt = this.points.reduce((s, p) => s + p.t, 0) / n;
    const mv = this.points.reduce((s, p) => s + p.v, 0) / n;
    const num = this.points.reduce((s, p) => s + (p.t - mt) * (p.v - mv), 0);
    const den = this.points.reduce((s, p) => s + (p.t - mt) ** 2, 0);
    return den === 0 ? null : (num / den) * 1000;
  }
}

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
const MIN_SAMPLES = 8;
/**
 * …and its share of the busiest gear's readings. Mid-shift readings (clutch in, RPM read a moment
 * before speed) recur at the same shift points every time, so a fixed count alone lets them pile up
 * into gears that don't exist.
 */
const MIN_SHARE = 0.15;
/**
 * Gears are numbered by rank, so the numbers mean nothing until most of the box has been seen: a
 * motorway run learns only top gear first, and would call it 1st.
 */
const MIN_GEARS = 4;
/** Same answer this many times running before it is shown. */
const STABLE = 3;
const MIN_KMH = 8;

/**
 * Guesses the gear from RPM ÷ speed. Each gear has its own ratio, so readings bunch into clusters
 * over a drive; the cluster with the highest ratio is 1st gear. Learns as it goes and returns null
 * until it has seen enough gears and a guess has held for a few readings.
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
    const busiest = Math.max(...this.clusters.map((c) => c.n));
    const trusted = (c: {n: number}) => c.n >= Math.max(MIN_SAMPLES, busiest * MIN_SHARE);
    if (!trusted(cluster)) {
      this.streak = 0;
      return null;
    }
    const gears = this.clusters.filter(trusted).sort((a, b) => b.ratio - a.ratio);
    if (gears.length < MIN_GEARS) {
      this.streak = 0;
      return null;
    }
    const gear = gears.indexOf(cluster) + 1;
    this.streak = gear === this.last ? this.streak + 1 : 1;
    this.last = gear;
    return this.streak >= STABLE ? gear : null;
  }
}
