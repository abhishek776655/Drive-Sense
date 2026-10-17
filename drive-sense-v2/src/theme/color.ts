/** `#RRGGBB` token at a given opacity, for fades built from theme colours. */
export const withAlpha = (hex: string, alpha: number): string => {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
};

/**
 * Splits `rgba(r,g,b,a)` (or `#RRGGBB`) into a solid colour and an opacity. react-native-svg gradient
 * stops ignore the alpha inside an rgba colour, so stops need it passed as `stopOpacity`.
 */
export const splitAlpha = (color: string): {color: string; opacity: number} => {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/.exec(color);
  if (!match) {
    return {color, opacity: 1};
  }
  const [, r, g, b, a] = match;
  return {color: `rgb(${r},${g},${b})`, opacity: a == null ? 1 : Number(a)};
};
