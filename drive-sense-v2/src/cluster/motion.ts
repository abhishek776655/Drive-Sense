/**
 * The cluster's maths (spec 2026-10-25, cluster mode), kept pure so it is tested without a GPU.
 * Angles are in degrees, clockwise from 3 o'clock (Skia's convention, y pointing down).
 */

/** Dials sweep 270°, from bottom-left round to bottom-right. */
export const DIAL_START = 135;
export const DIAL_SWEEP = 270;
/** The engine-load meter is a half circle over the top. */
export const METER_START = 180;
export const METER_SWEEP = 180;

const clamp01 = (n: number) => {
  'worklet';
  return Math.min(1, Math.max(0, n));
};

/** Share of the dial (0–1) a value fills. */
export const fraction = (value: number | null | undefined, max: number): number => (value == null || max <= 0 ? 0 : clamp01(value / max));

/** Angle of a point `share` (0–1) along an arc. */
export const angleAt = (share: number, start?: number, sweep?: number) => {
  'worklet';
  // Defaults written out: a worklet doesn't capture module constants used in default parameters.
  return (start ?? 135) + (sweep ?? 270) * Math.min(1, Math.max(0, share));
};

/** Point on a circle at an angle. */
export const polar = (cx: number, cy: number, r: number, deg: number) => {
  'worklet';
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

/** SVG path of the arc from share `from` to `to` (0–1); Skia reads it with `Skia.Path.MakeFromSVGString`. */
export const arcPath = (cx: number, cy: number, r: number, from: number, to: number, start = DIAL_START, sweep = DIAL_SWEEP): string => {
  const a = polar(cx, cy, r, angleAt(from, start, sweep));
  const b = polar(cx, cy, r, angleAt(to, start, sweep));
  const large = sweep * (clamp01(to) - clamp01(from)) > 180 ? 1 : 0;
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M ${f(a.x)} ${f(a.y)} A ${r} ${r} 0 ${large} 1 ${f(b.x)} ${f(b.y)}`;
};

/** Tick values for a dial: majors every `major`, minors every `minor`, up to `max`. */
export const ticks = (max: number, major: number, minor: number): {value: number; major: boolean}[] => {
  const out: {value: number; major: boolean}[] = [];
  for (let v = 0; v <= max + 1e-6; v += minor) {
    out.push({value: Math.round(v), major: Math.abs(v / major - Math.round(v / major)) < 1e-6});
  }
  return out;
};

/** A round dial top: the next multiple of `step` at or above the highest of `values`, at least `floor`. */
export const dialMax = (floor: number, step: number, ...values: (number | null | undefined)[]) =>
  Math.max(floor, ...values.map((v) => (v == null ? 0 : Math.ceil(v / step) * step)));

/**
 * How hot the redline glows (0–1): nothing until 1,000 rpm short of it, then rising to full at the
 * redline. At or past it the dial pulses (the caller animates the pulse).
 */
export const redlineHeat = (rpm: number | null | undefined, redline: number): number => (rpm == null ? 0 : clamp01((rpm - (redline - 1000)) / 1000));

/** Particle speed along the engine-load meter, in meter-lengths per second: a trickle at cruise, a rush flat out. */
export const particleSpeed = (loadPct: number | null | undefined): number => 0.08 + 0.9 * fraction(loadPct, 100) ** 1.5;

/** Coasting: rolling (over 5 km/h) with the throttle closed, i.e. within 2 points of its lowest reading. */
export const isCoasting = (throttlePct: number | null | undefined, closedThrottlePct: number | null, speedKmh: number | null | undefined): boolean =>
  throttlePct != null && closedThrottlePct != null && speedKmh != null && speedKmh > 5 && throttlePct <= closedThrottlePct + 2;

/** Load above this warms the meter from the accent toward amber. */
export const HOT_LOAD_PCT = 80;
export const loadHeat = (loadPct: number | null | undefined): number => clamp01(((loadPct ?? 0) - HOT_LOAD_PCT) / (100 - HOT_LOAD_PCT));

const G = 9.81;

/**
 * G-force from two fixes, independent of how the phone is mounted: longitudinal from the change in
 * speed, lateral from speed times the rate of turning. Positive lon = speeding up, positive lat =
 * turning right.
 */
export const gFrom = (
  prev: {speedMps: number; headingDeg: number | null; at: number},
  next: {speedMps: number; headingDeg: number | null; at: number},
): {lon: number; lat: number} | null => {
  const dt = (next.at - prev.at) / 1000;
  if (dt <= 0 || dt > 5) {
    return null;
  }
  const lon = (next.speedMps - prev.speedMps) / dt / G;
  let lat = 0;
  if (prev.headingDeg != null && next.headingDeg != null) {
    const turn = ((((next.headingDeg - prev.headingDeg + 540) % 360) + 360) % 360) - 180;
    lat = (next.speedMps * ((turn * Math.PI) / 180)) / dt / G;
  }
  return {lon, lat};
};

/** A G reading as a point in a dial of radius `r` showing up to `maxG`, clamped to the rim. */
export const gPoint = (g: {lon: number; lat: number}, r: number, maxG = 1) => {
  'worklet';
  const x = (g.lat / maxG) * r;
  const y = (-g.lon / maxG) * r; // speeding up moves the dot up, braking down
  const len = Math.hypot(x, y);
  return len > r ? {x: (x / len) * r, y: (y / len) * r} : {x, y};
};

/** Revs above which a shift up is suggested (diesels pull lower), and the gears that can take one. */
const SHIFT_RPM = {petrol: 2800, diesel: 2300} as const;
const TOP_GEAR = 6;
/** Above this throttle the driver is asking for the revs; no hint. */
const HARD_THROTTLE_PCT = 70;

/** The gear to shift up to, when revving high in a known low gear without pushing hard; else null. */
export const shiftUpHint = (rpm: number | null, gear: string | null, fuel: string | null, throttlePct: number | null): string | null => {
  const g = gear == null ? NaN : Number(gear);
  if (rpm == null || !Number.isInteger(g) || g < 1 || g >= TOP_GEAR) {
    return null;
  }
  if (throttlePct != null && throttlePct >= HARD_THROTTLE_PCT) {
    return null;
  }
  return rpm >= (fuel === 'diesel' ? SHIFT_RPM.diesel : SHIFT_RPM.petrol) ? String(g + 1) : null;
};

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Eight-point compass name of a GPS heading; null when there is none (standing still reports -1). */
export const compassPoint = (deg: number | null | undefined): string | null =>
  deg == null || deg < 0 ? null : POINTS[Math.round((deg % 360) / 45) % 8];

/** Gradient is measured over this much road, and needs at least the shorter span to say anything. */
export const GRADE_WINDOW_M = 150;
const GRADE_MIN_M = 40;

/**
 * Road gradient (%) from GPS altitude against distance driven: the least-squares slope over the last
 * `GRADE_WINDOW_M`, which rides out GPS altitude jitter better than two end points. Null when the
 * car hasn't covered enough road.
 */
export const gradePct = (samples: {d: number; alt: number}[], windowM = GRADE_WINDOW_M): number | null => {
  if (samples.length < 3) {
    return null;
  }
  const end = samples[samples.length - 1].d;
  const recent = samples.filter((p) => p.d >= end - windowM);
  if (recent.length < 3 || end - recent[0].d < GRADE_MIN_M) {
    return null;
  }
  const n = recent.length;
  const md = recent.reduce((a, p) => a + p.d, 0) / n;
  const ma = recent.reduce((a, p) => a + p.alt, 0) / n;
  const num = recent.reduce((a, p) => a + (p.d - md) * (p.alt - ma), 0);
  const den = recent.reduce((a, p) => a + (p.d - md) ** 2, 0);
  return den === 0 ? null : (num / den) * 100;
};
