/** One second of a drive's OBD data (spec 2026-10-25, telemetry, section 4); absent = not read. */
export type ObdRow = Partial<Record<'speed' | 'rpm' | 'throttle' | 'load' | 'coolant' | 'maf' | 'fuelRate' | 'fuelFlow' | 'fuelLevel' | 'voltage' | 'intakeTemp' | 'map', number>>;

export interface ObdSampleRow {
  ts: number;
  row: ObdRow;
}

export interface ObdStats {
  avgRpm: number | null;
  maxRpm: number | null;
  maxCoolantC: number | null;
  fuelUsedL: number | null;
  avgL100km: number | null;
  idleS: number;
  /** Share of the drive (0–1) with OBD data. */
  coverage: number;
  /** Fuel burned with the engine running at a standstill; absent on drives recorded before it existed. */
  idleFuelL?: number | null;
  /** Eco driving (absent on older drives): share of moving time coasting with the throttle closed… */
  coastShare?: number | null;
  /** …seconds above the high-RPM line… */
  highRpmS?: number | null;
  /** …seconds from engine start to coolant at 70 °C (0: warm start; null: never warmed up)… */
  warmupS?: number | null;
  /** …and the moving seconds the coasting share is out of. */
  movingS?: number;
}

/** Above this RPM counts as revving hard; diesels turn slower. */
export const HIGH_RPM = {petrol: 3000, diesel: 2500} as const;
/** Coolant at this temperature or above: the engine has warmed up. */
export const WARM_COOLANT_C = 70;
/** Throttle within this many points of the drive's lowest reading counts as closed. */
const CLOSED_THROTTLE_SLACK = 2;
const MOVING_KMH = 5;

/**
 * Eco-driving figures for a drive's 1 Hz rows (spec 2026-10-25, telemetry sources, section 2).
 * Throttle position seldom reads 0 even when closed, so "closed" is relative to the drive's lowest.
 */
export const ecoStats = (rows: ObdSampleRow[], highRpm: number = HIGH_RPM.petrol): Pick<ObdStats, 'coastShare' | 'highRpmS' | 'warmupS' | 'movingS'> => {
  const throttles = rows.map((r) => r.row.throttle).filter((v): v is number => v != null);
  const closedBelow = throttles.length > 0 ? Math.min(...throttles) + CLOSED_THROTTLE_SLACK : null;
  let moving = 0;
  let coasting = 0;
  let high = 0;
  let hasRpm = false;
  let started: number | null = null;
  let warmup: number | null = null;
  rows.forEach(({ts, row}, i) => {
    const step = i === 0 ? 1 : Math.min(MAX_STEP_S, Math.max(0, (ts - rows[i - 1].ts) / 1000));
    const running = (row.rpm ?? 0) > 0;
    if (row.rpm != null) {
      hasRpm = true;
      if (row.rpm > highRpm) {
        high += step;
      }
    }
    if (running && (row.speed ?? 0) > MOVING_KMH) {
      moving += step;
      if (closedBelow != null && row.throttle != null && row.throttle <= closedBelow) {
        coasting += step;
      }
    }
    if (running && started == null) {
      started = ts;
    }
    if (warmup == null && started != null && row.coolant != null && row.coolant >= WARM_COOLANT_C) {
      warmup = Math.round((ts - started) / 1000);
    }
  });
  return {
    coastShare: moving > 0 && closedBelow != null ? round(coasting / moving, 3) : null,
    highRpmS: hasRpm ? Math.round(high) : null,
    warmupS: warmup,
    movingS: Math.round(moving),
  };
};

export const SERIES_KEYS = ['rpm', 'speed', 'coolant', 'fuelFlow', 'throttle', 'load'] as const;
export type SeriesKey = (typeof SERIES_KEYS)[number];

/** Chart data, column-wise. `t` is seconds from the drive's start; null = no data in that bucket. */
export type ObdSeries = {t: number[]} & Record<SeriesKey, (number | null)[]>;

/** At most this many points per series: more than a phone-wide chart has pixels. */
export const SERIES_MAX = 600;
/** These keep each bucket's highest value, so a short spike is never averaged away. */
const PEAK_KEYS: SeriesKey[] = ['rpm', 'coolant'];
/** Longest gap between rows still counted as continuous for fuel and idle time. */
const MAX_STEP_S = 5;
/** Below this the drive is too short for a meaningful L/100 km. */
const MIN_ECONOMY_KM = 0.5;

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

export const summarize = (rows: ObdSampleRow[], driveSeconds: number, highRpm: number = HIGH_RPM.petrol): ObdStats => {
  let rpmSum = 0;
  let rpmN = 0;
  let maxRpm: number | null = null;
  let maxCoolant: number | null = null;
  let fuel = 0;
  let hasFuel = false;
  let km = 0;
  let idle = 0;
  let idleFuel = 0;
  let hasIdleFuel = false;
  // A row holds only the PIDs read that second, so distance and fuel each use the latest value seen:
  // otherwise a row with fuel flow but no speed burns fuel over no distance.
  let lastSpeed: number | null = null;
  rows.forEach(({ts, row}, i) => {
    const step = i === 0 ? 1 : Math.min(MAX_STEP_S, Math.max(0, (ts - rows[i - 1].ts) / 1000));
    lastSpeed = row.speed ?? lastSpeed;
    if (row.rpm != null) {
      maxRpm = Math.max(maxRpm ?? 0, row.rpm);
      if (row.rpm > 0) {
        rpmSum += row.rpm;
        rpmN += 1;
      }
    }
    if (row.coolant != null) {
      maxCoolant = Math.max(maxCoolant ?? -Infinity, row.coolant);
    }
    if (row.fuelFlow != null) {
      fuel += (row.fuelFlow / 3600) * step;
      hasFuel = true;
    }
    if (lastSpeed != null) {
      km += (lastSpeed / 3600) * step;
    }
    if ((row.rpm ?? 0) > 0 && lastSpeed === 0) {
      idle += step;
      if (row.fuelFlow != null) {
        idleFuel += (row.fuelFlow / 3600) * step;
        hasIdleFuel = true;
      }
    }
  });
  return {
    avgRpm: rpmN > 0 ? Math.round(rpmSum / rpmN) : null,
    maxRpm,
    maxCoolantC: maxCoolant,
    fuelUsedL: hasFuel ? round(fuel, 2) : null,
    avgL100km: hasFuel && km >= MIN_ECONOMY_KM ? round((fuel / km) * 100, 1) : null,
    idleS: Math.round(idle),
    coverage: driveSeconds > 0 ? Math.min(1, round(rows.length / driveSeconds, 3)) : 0,
    idleFuelL: hasIdleFuel ? round(idleFuel, 3) : hasFuel ? 0 : null,
    ...ecoStats(rows, highRpm),
  };
};

export const downsample = (rows: ObdSampleRow[], startedAt: number, max = SERIES_MAX): ObdSeries => {
  const series = {t: [] as number[]} as ObdSeries;
  SERIES_KEYS.forEach((k) => (series[k] = []));
  if (rows.length === 0) {
    return series;
  }
  const offset = (ts: number) => Math.max(0, Math.floor((ts - startedAt) / 1000));
  const first = offset(rows[0].ts);
  const span = offset(rows[rows.length - 1].ts) - first + 1;
  const size = Math.max(1, Math.ceil(span / max));
  const count = Math.ceil(span / size);
  const buckets = Array.from({length: count}, () => [] as ObdRow[]);
  for (const {ts, row} of rows) {
    buckets[Math.min(count - 1, Math.floor((offset(ts) - first) / size))].push(row);
  }
  buckets.forEach((bucket, i) => {
    series.t.push(first + i * size);
    for (const k of SERIES_KEYS) {
      const values = bucket.map((r) => r[k]).filter((v): v is number => v != null);
      if (values.length === 0) {
        series[k].push(null);
      } else if (PEAK_KEYS.includes(k)) {
        series[k].push(Math.max(...values));
      } else {
        series[k].push(round(values.reduce((a, b) => a + b, 0) / values.length, 1));
      }
    }
  });
  return series;
};
