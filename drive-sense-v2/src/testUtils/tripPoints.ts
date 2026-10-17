import type {TripPoint} from '../services/tripService';

/** A point `s` seconds after a fixed start, `m` metres north of the origin. */
export const pt = (s: number, m: number, speed: number | null = null, alt: number | null = null): TripPoint => ({
  recorded_at: new Date(Date.UTC(2026, 9, 11, 14, 0, 0) + s * 1000).toISOString(),
  latitude: 28.6 + m / 111_195,
  longitude: 77.2,
  speed_mps: speed,
  altitude_m: alt,
});
