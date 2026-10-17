/**
 * Speed → colour on the trip page: one continuous scale shared by the route, the legend and the
 * speed chart, built from theme tokens so it follows Light / Dark.
 */
export type SpeedScaleColors = {cyan: string; green: string; amber: string; accent: string; red: string};

export const SPEED_SCALE_KMH = [0, 25, 50, 75, 100] as const;

const stopColors = (c: SpeedScaleColors) => [c.cyan, c.green, c.amber, c.accent, c.red];

const parseHex = (hex: string): number[] | null => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) {
    return null;
  }
  const h = m[1].length === 3 ? m[1].replace(/./g, (ch) => ch + ch) : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Normalised to lower-case hex when the token is hex; left as-is otherwise. */
const solid = (color: string) => {
  const rgb = parseHex(color);
  return rgb ? toHex(rgb) : color;
};

export const speedColor = (kmh: number, colors: SpeedScaleColors): string => {
  const stops = stopColors(colors);
  const last = SPEED_SCALE_KMH.length - 1;
  if (!(kmh > SPEED_SCALE_KMH[0])) {
    return solid(stops[0]);
  }
  if (kmh >= SPEED_SCALE_KMH[last]) {
    return solid(stops[last]);
  }
  let i = 0;
  while (kmh >= SPEED_SCALE_KMH[i + 1]) {
    i += 1;
  }
  const a = parseHex(stops[i]);
  const b = parseHex(stops[i + 1]);
  if (!a || !b) {
    // A translucent or named token cannot be blended; hold the lower stop's colour.
    return solid(stops[i]);
  }
  const f = (kmh - SPEED_SCALE_KMH[i]) / (SPEED_SCALE_KMH[i + 1] - SPEED_SCALE_KMH[i]);
  return toHex(a.map((v, k) => v + (b[k] - v) * f));
};

export const speedScaleStops = (colors: SpeedScaleColors) => SPEED_SCALE_KMH.map((kmh) => ({kmh, color: speedColor(kmh, colors)}));
