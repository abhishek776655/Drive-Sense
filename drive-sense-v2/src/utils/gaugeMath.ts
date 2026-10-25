/**
 * Dial geometry. Angles are degrees clockwise from 3 o'clock, which is how SVG's y-down space
 * reads them, so 135° is bottom-left and the 270° sweep ends at bottom-right (45°).
 */
export const GAUGE_START_DEG = 135;
export const GAUGE_SWEEP_DEG = 270;

export type SpeedScale = 'auto' | 120 | 200 | 300;

export const clampFraction = (value: number | null | undefined, max: number): number => {
  if (value == null || !Number.isFinite(value) || max <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, value / max));
};

/** Auto picks the smallest fixed scale that keeps the trip's top speed below ~90% of the dial. */
export const resolveScaleKmh = (scale: SpeedScale, topSpeedKmh: number | null): number => {
  if (scale !== 'auto') {
    return scale;
  }
  const top = topSpeedKmh ?? 0;
  if (top <= 108) {
    return 120;
  }
  if (top <= 180) {
    return 200;
  }
  return 300;
};

export const valueToAngle = (value: number | null | undefined, max: number): number =>
  GAUGE_START_DEG + GAUGE_SWEEP_DEG * clampFraction(value, max);

export const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

const fmt = (n: number) => Number(n.toFixed(2));

/** Clockwise arc from `startDeg` to `endDeg`. Returns '' for an empty sweep so nothing is drawn. */
export const arcPath = (cx: number, cy: number, r: number, startDeg: number, endDeg: number): string => {
  const sweep = endDeg - startDeg;
  if (sweep <= 0.01) {
    return '';
  }
  const a = polar(cx, cy, r, startDeg);
  const b = polar(cx, cy, r, endDeg);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M${fmt(a.x)} ${fmt(a.y)}A${r} ${r} 0 ${largeArc} 1 ${fmt(b.x)} ${fmt(b.y)}`;
};

/** A round step for labels: about `count` labels across the scale, at 10, 20, 25, 50 … */
export const niceStep = (scale: number, count = 6): number => {
  const raw = scale / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10;
  return nice * pow;
};
