/**
 * Road roughness (spec 2026-10-25, telemetry sources, section 3): how much the car shakes up and
 * down, as the RMS of vertical acceleration over each 100 m, bucketed smooth / fair / rough.
 */

/** Gravity-free acceleration (DeviceMotion `acceleration`) along gravity: the up-and-down shake. */
export const verticalAccel = (acc: {x: number; y: number; z: number}, gravity: {x: number; y: number; z: number}): number => {
  const len = Math.hypot(gravity.x, gravity.y, gravity.z) || 1;
  return (acc.x * gravity.x + acc.y * gravity.y + acc.z * gravity.z) / len;
};

export const SEGMENT_M = 100;
export type RoadLevel = 'smooth' | 'fair' | 'rough';

/** RMS vertical shake (m/s²) to a level; set from typical phone readings on asphalt, worn and broken roads. */
export const roadLevel = (rms: number): RoadLevel => (rms < 0.6 ? 'smooth' : rms < 1.4 ? 'fair' : 'rough');

export type RoughSegment = {latitude: number; longitude: number; rms: number; level: RoadLevel};
export type RoughState = {startM: number | null; sumSq: number; n: number; segments: RoughSegment[]};
export const EMPTY_ROUGH: RoughState = {startM: null, sumSq: 0, n: 0, segments: []};

/** One vertical reading at a drive distance; every 100 m the segment closes where the car is. */
export const stepRough = (s: RoughState, vertical: number, distanceM: number, where: {latitude: number; longitude: number} | null): RoughState => {
  const startM = s.startM ?? distanceM;
  const next = {...s, startM, sumSq: s.sumSq + vertical * vertical, n: s.n + 1};
  if (distanceM - startM < SEGMENT_M || !where) {
    return next;
  }
  const rms = Math.sqrt(next.sumSq / next.n);
  return {startM: distanceM, sumSq: 0, n: 0, segments: [...s.segments, {...where, rms, level: roadLevel(rms)}]};
};

/** Shares of the drive's segments at each level; null with none. */
export const roadSummary = (segments: RoughSegment[]): {smooth: number; fair: number; rough: number} | null => {
  if (segments.length === 0) {
    return null;
  }
  const share = (level: RoadLevel) => segments.filter((x) => x.level === level).length / segments.length;
  return {smooth: share('smooth'), fair: share('fair'), rough: share('rough')};
};
