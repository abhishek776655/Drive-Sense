/**
 * Direction of travel, ported from mobile-expo's live tracking: GPS course while moving, the
 * bearing between fixes as a fallback, smoothed so the arrow does not jitter, held when stopped.
 */
type Point = {latitude: number; longitude: number};

/** At or above this speed (m/s) the car counts as moving (old app's `is_moving`). */
export const MOVING_MPS = 0.8;
/** GPS course is only trusted above this speed (m/s); below it the bearing fallback is used. */
const NATIVE_HEADING_MIN_MPS = 1;
/** Bearing between fixes needs this much movement (m) to mean anything. */
const BEARING_MIN_STEP_M = 4;
/** Share of each new reading blended into the held heading. */
const SMOOTHING = 0.42;

export const normalizeHeading = (value: number): number => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

/** Shortest signed turn from `from` to `to`, in (-180, 180]. */
export const headingDelta = (from: number, to: number): number => {
  const delta = normalizeHeading(to) - normalizeHeading(from);
  if (delta > 180) {
    return delta - 360;
  }
  if (delta < -180) {
    return delta + 360;
  }
  return delta;
};

export const smoothHeading = (from: number, to: number, factor = SMOOTHING): number =>
  normalizeHeading(from + headingDelta(from, to) * factor);

export const bearingBetween = (from: Point, to: Point): number => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normalizeHeading((Math.atan2(y, x) * 180) / Math.PI);
};

export interface HeadingInput {
  previousHeading: number | null;
  previousPoint: Point | null;
  point: Point;
  speedMps: number | null;
  nativeHeading: number | null;
  stepMeters: number;
}

/** Next held heading, or null while it is still unknown (no movement yet). */
export const resolveHeading = ({previousHeading, previousPoint, point, speedMps, nativeHeading, stepMeters}: HeadingInput): number | null => {
  const speed = speedMps ?? 0;
  let raw: number | null = null;
  if (nativeHeading != null && nativeHeading >= 0 && speed >= NATIVE_HEADING_MIN_MPS) {
    raw = nativeHeading;
  } else if (previousPoint && stepMeters > BEARING_MIN_STEP_M) {
    raw = bearingBetween(previousPoint, point);
  }
  if (raw == null) {
    return previousHeading;
  }
  return previousHeading == null ? normalizeHeading(raw) : smoothHeading(previousHeading, raw);
};

const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export const compass16 = (deg: number): string => COMPASS_16[Math.round(normalizeHeading(deg) / 22.5) % 16];

/** "212° SSW". */
export const formatHeading = (deg: number): string => `${Math.round(normalizeHeading(deg)) % 360}° ${compass16(deg)}`;

/** A point `meters` ahead along `headingDeg`, so a tilted camera shows more road in front. */
export const lookAhead = (point: Point, headingDeg: number, meters: number): Point => {
  const rad = (normalizeHeading(headingDeg) * Math.PI) / 180;
  return {
    latitude: point.latitude + (Math.cos(rad) * meters) / 111_320,
    longitude: point.longitude + (Math.sin(rad) * meters) / (111_320 * Math.cos((point.latitude * Math.PI) / 180)),
  };
};
