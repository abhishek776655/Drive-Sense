import type {PointStats} from './pointStats';

/** One ended drive, as the phone's stats see it (a synced trip or one waiting to upload). */
export interface TripFacts {
  id: string;
  vehicleId: string;
  vehicleName: string;
  /** ISO start, exactly as stored (records and achievements hand it back). */
  startTime: string;
  startMs: number;
  startAddress: string | null;
  endAddress: string | null;
  distance: number;
  duration: number;
  idle: number;
  maxSpeed: number | null;
  maxG: number | null;
  maxGSource: string | null;
  leftTurns: number | null;
  rightTurns: number | null;
  score: number | null;
  harshBrakes: number;
  rapidAccels: number;
  overspeeds: number;
  /** Null until the drive's route is on the phone. */
  points: PointStats | null;
}

/** `GREATEST(duration - idle, 0)`: time spent moving. */
export const movingOf = (t: TripFacts) => Math.max(t.duration - t.idle, 0);

export const average = (values: number[]): number | null => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export const sumOf = <T,>(items: T[], value: (item: T) => number) => items.reduce((sum, item) => sum + value(item), 0);

/** Largest value, or null when there is none. */
export const maxOf = (values: (number | null)[]): number | null => {
  let best: number | null = null;
  for (const v of values) {
    if (v != null && (best == null || v > best)) {
      best = v;
    }
  }
  return best;
};
