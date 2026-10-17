import type {TripFacts} from '../stats/facts';

let next = 0;

/** A drive starting at a local time (month is 1-based here, unlike `Date`). */
export const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min);

export const fact = (start: Date, patch: Partial<TripFacts> = {}): TripFacts => ({
  id: `t${++next}`,
  vehicleId: 'v1',
  vehicleName: 'Octavia',
  startTime: start.toISOString(),
  startMs: start.getTime(),
  startAddress: null,
  endAddress: null,
  distance: 5000,
  duration: 1200,
  idle: 0,
  maxSpeed: 15,
  maxG: null,
  maxGSource: null,
  leftTurns: null,
  rightTurns: null,
  score: null,
  harshBrakes: 0,
  rapidAccels: 0,
  overspeeds: 0,
  points: null,
  ...patch,
});
