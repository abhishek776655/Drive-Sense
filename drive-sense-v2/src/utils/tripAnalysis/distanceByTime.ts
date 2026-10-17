import type {Segment} from './prepare';

export interface DistanceBucket {
  /** Bucket start, aligned to the clock (14:00, 14:05, …). */
  start: number;
  meters: number;
}

/** Bucket size so the chart has a handful of bars: 1 min up to 15 min, 5 min up to an hour, 15 min up to 3 h, then hours. */
export const bucketMinutesFor = (durationS: number): number =>
  durationS <= 15 * 60 ? 1 : durationS <= 3600 ? 5 : durationS <= 3 * 3600 ? 15 : 60;

/** Distance driven per clock-aligned bucket, from the first to the last bucket with movement. */
export const distanceByTime = (segs: Segment[], bucketMinutes: number): DistanceBucket[] => {
  if (segs.length === 0) {
    return [];
  }
  const size = bucketMinutes * 60_000;
  const totals = new Map<number, number>();
  for (const s of segs) {
    const start = Math.floor(s.from.t / size) * size;
    totals.set(start, (totals.get(start) ?? 0) + s.meters);
  }
  const keys = [...totals.keys()];
  const first = Math.min(...keys);
  const last = Math.max(...keys);
  const out: DistanceBucket[] = [];
  for (let start = first; start <= last; start += size) {
    out.push({start, meters: totals.get(start) ?? 0});
  }
  return out;
};
