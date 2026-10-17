import {haversineMeters} from '../geo';
import {MAX_GAP_S, type CleanPoint} from './prepare';
import {thin} from './thin';

/** Altitude changes smaller than this are GPS wobble, not climbing. */
export const ELEVATION_STEP_M = 3;

/** Climbing / descending is judged over windows this long, so GPS altitude jitter averages out. */
const WINDOW_S = 30;
/** Grades below 1 %, or windows covering under 50 m (crawling, standing), count as flat. */
const MIN_GRADE = 0.01;
const MIN_WINDOW_M = 50;

export interface ElevationProfile {
  series: {t: number; m: number}[];
  gainM: number;
  lossM: number;
  maxM: number;
  minM: number;
  climbS: number;
  descentS: number;
  flatS: number;
}

type AltPoint = CleanPoint & {altitude: number};

const gradeTimes = (valid: AltPoint[]) => {
  const out = {climbS: 0, descentS: 0, flatS: 0};
  let i = 0;
  while (i < valid.length - 1) {
    let j = i;
    let meters = 0;
    while (j < valid.length - 1 && (valid[j].t - valid[i].t) / 1000 < WINDOW_S) {
      meters += haversineMeters(valid[j], valid[j + 1]);
      j += 1;
    }
    const seconds = (valid[j].t - valid[i].t) / 1000;
    if (seconds > 0 && seconds <= MAX_GAP_S) {
      const grade = meters > 0 ? (valid[j].altitude - valid[i].altitude) / meters : 0;
      if (meters < MIN_WINDOW_M || Math.abs(grade) < MIN_GRADE) {
        out.flatS += seconds;
      } else if (grade > 0) {
        out.climbS += seconds;
      } else {
        out.descentS += seconds;
      }
    }
    i = j;
  }
  return out;
};

/** Profile, climb and drop. Null without at least two real altitudes. */
export const elevationProfile = (points: CleanPoint[], maxSamples = 200): ElevationProfile | null => {
  const valid = points.filter((p): p is AltPoint => p.altitude != null);
  if (valid.length < 2) {
    return null;
  }
  // The reference only moves once a change of at least ELEVATION_STEP_M is counted.
  let ref = valid[0].altitude;
  let gainM = 0;
  let lossM = 0;
  for (const p of valid) {
    const diff = p.altitude - ref;
    if (diff >= ELEVATION_STEP_M) {
      gainM += diff;
      ref = p.altitude;
    } else if (diff <= -ELEVATION_STEP_M) {
      lossM -= diff;
      ref = p.altitude;
    }
  }
  const alts = valid.map((p) => p.altitude);
  return {
    series: thin(valid, maxSamples).map((p) => ({t: p.t, m: p.altitude})),
    gainM: Math.round(gainM),
    lossM: Math.round(lossM),
    maxM: Math.max(...alts),
    minM: Math.min(...alts),
    ...gradeTimes(valid),
  };
};
