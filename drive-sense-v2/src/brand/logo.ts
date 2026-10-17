/**
 * DriveSense logo geometry: an orange road tapering to the horizon (spec 2026-10-17, brand logo).
 * Import-free and plain TypeScript so `scripts/write-brand-svgs.mjs` can run it under Node to build
 * the icon and splash PNGs: the app logo and the store icon share one source.
 */

export const LOGO_SIZE = 1024;
/** Rounded-square tile used in the app; the iOS icon is full bleed and masked by the OS. */
export const TILE_RADIUS = 230;
/** The splash mark fades the road in from the bottom edge up to this line. */
export const FADE_TOP_Y = 800;
export const HORIZON = {y: 330, x1: 140, x2: 884, width: 6, opacity: 0.35};

export const BRAND_INK = '#000000';
export const BRAND_ROAD = '#FF6D00';
export const BRAND_PAPER = '#FFFFFF';

type Point = {x: number; y: number};

/** Road midline: leaves the bottom edge straight up, bends right, then settles onto the horizon. */
const MID: Point[] = [
  {x: 512, y: 1024},
  {x: 512, y: 760},
  {x: 640, y: 560},
  {x: 560, y: HORIZON.y},
];
const NEAR_HALF_WIDTH = 240;
/** World depth at the bottom edge and at the horizon, in dash periods. */
const NEAR_DEPTH = 2;
const FAR_DEPTH = 20;
/** Share of a period that is painted, and a dash's half-width as a share of the road's. */
const DASH_LENGTH = 0.45;
const DASH_WIDTH = 0.055;
/** Dashes thinner than this (logo units) vanish at icon sizes, so they are not drawn. */
const MIN_DASH_HALF_WIDTH = 1.5;

const bezier = (t: number): Point => {
  const u = 1 - t;
  const [a, b, c, d] = MID;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
};

/** Road half-width at screen height y: in perspective it shrinks linearly to nothing at the horizon. */
const halfWidthAtY = (y: number): number => NEAR_HALF_WIDTH * Math.max(0, (y - HORIZON.y) / (LOGO_SIZE - HORIZON.y));

/** Midline t at screen height y; the midline only ever climbs, so bisection finds it. */
const tAtY = (y: number): number => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(mid).y > y) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
};

// One decimal keeps paths short; `+ 0` turns -0 into 0 so equal shapes print equal strings.
const fmt = (n: number): string => String(Math.round(n * 10) / 10 + 0);

/**
 * Closed band along the midline between screen heights y0 (near) and y1 (far), `scale` road
 * half-widths wide. Cross-sections are horizontal, as a flat road's are in perspective.
 */
const band = (y0: number, y1: number, steps: number, scale: number): string => {
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps;
    const x = bezier(tAtY(y)).x;
    const w = halfWidthAtY(y) * scale;
    left.push(`${fmt(x - w)} ${fmt(y)}`);
    right.push(`${fmt(x + w)} ${fmt(y)}`);
  }
  return 'M' + [...left, ...right.reverse()].join('L') + 'Z';
};

export const roadPath = (): string => band(LOGO_SIZE, HORIZON.y, 64, 1);

/** Perspective: height above the bottom edge goes with 1/depth, so equal steps bunch up toward the horizon. */
const depthToY = (z: number): number => HORIZON.y + (LOGO_SIZE - HORIZON.y) * (NEAR_DEPTH / z);

export const centreDashes = (phase: number): string => {
  const parts: string[] = [];
  // k = -1 supplies the dash that slides in from the bottom edge as phase grows.
  for (let k = -1; k < FAR_DEPTH - NEAR_DEPTH; k++) {
    const start = NEAR_DEPTH + k + phase;
    const from = Math.max(start, NEAR_DEPTH);
    const to = Math.min(start + DASH_LENGTH, FAR_DEPTH);
    if (to <= from) {
      continue;
    }
    const y0 = depthToY(from);
    const y1 = depthToY(to);
    if (halfWidthAtY(y1) * DASH_WIDTH < MIN_DASH_HALF_WIDTH) {
      continue;
    }
    parts.push(band(y0, y1, 6, DASH_WIDTH));
  }
  return parts.join('');
};
