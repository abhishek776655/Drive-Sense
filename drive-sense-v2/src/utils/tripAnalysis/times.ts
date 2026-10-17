import {STOPPED_KMH, type Segment} from './prepare';

export const SPEED_BANDS = [
  {label: '0–20', min: 0, max: 20},
  {label: '20–40', min: 20, max: 40},
  {label: '40–60', min: 40, max: 60},
  {label: '60–80', min: 60, max: 80},
  {label: '80–100', min: 80, max: 100},
  {label: '100+', min: 100, max: Infinity},
];

export interface TripTimes {
  movingS: number;
  idleS: number;
}

export interface SpeedBand {
  label: string;
  seconds: number;
  meters: number;
  /** Share of moving time, 0..1. */
  share: number;
}

const moving = (s: Segment) => s.kmh >= STOPPED_KMH;

export const tripTimes = (segs: Segment[]): TripTimes =>
  segs.reduce(
    (acc, s) => (moving(s) ? {...acc, movingS: acc.movingS + s.seconds} : {...acc, idleS: acc.idleS + s.seconds}),
    {movingS: 0, idleS: 0},
  );

/** Moving time per speed band. Stopped time is in no band. */
export const timeAtSpeed = (segs: Segment[]): SpeedBand[] => {
  const bands = SPEED_BANDS.map((b) => ({label: b.label, seconds: 0, meters: 0, share: 0}));
  let total = 0;
  for (const s of segs) {
    if (!moving(s)) {
      continue;
    }
    const i = SPEED_BANDS.findIndex((b) => s.kmh >= b.min && s.kmh < b.max);
    bands[i].seconds += s.seconds;
    bands[i].meters += s.meters;
    total += s.seconds;
  }
  return bands.map((b) => ({...b, share: total > 0 ? b.seconds / total : 0}));
};
