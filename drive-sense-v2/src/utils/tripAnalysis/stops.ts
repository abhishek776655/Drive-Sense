import {STOPPED_KMH, type Segment} from './prepare';

/** Shorter halts (a slow crawl, a give-way) are not worth listing. */
export const MIN_STOP_S = 30;

export interface Stop {
  startedAt: number;
  durationS: number;
  latitude: number;
  longitude: number;
}

/** Runs of stopped segments of 30 s or more. Waiting at the start or end of a trip is not a stop. */
export const detectStops = (segs: Segment[]): Stop[] => {
  const stops: Stop[] = [];
  let i = 0;
  while (i < segs.length) {
    if (segs[i].kmh >= STOPPED_KMH) {
      i += 1;
      continue;
    }
    const first = i;
    let durationS = 0;
    while (i < segs.length && segs[i].kmh < STOPPED_KMH) {
      durationS += segs[i].seconds;
      i += 1;
    }
    const touchesEdge = first === 0 || i === segs.length;
    if (!touchesEdge && durationS >= MIN_STOP_S) {
      const at = segs[first].from;
      stops.push({startedAt: at.t, durationS, latitude: at.latitude, longitude: at.longitude});
    }
  }
  return stops;
};

export type DayPeriod = 'day' | 'night';

/** By the trip's local start hour. */
export const dayPeriod = (startIso: string): DayPeriod => {
  const hour = new Date(startIso).getHours();
  return hour < 6 || hour >= 19 ? 'night' : 'day';
};
