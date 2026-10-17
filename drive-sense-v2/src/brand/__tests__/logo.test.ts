import {DARK_PALETTE, ORANGE_ACCENT} from '../../theme/palettes';
import {BRAND_INK, BRAND_ROAD, centreDashes, LOGO_SIZE, roadPath} from '../logo';

/** Bounding box of each `M…Z` sub-path. */
const boxes = (d: string) =>
  d
    .split('M')
    .filter(Boolean)
    .map((part) => {
      const nums = part.replace('Z', '').split('L').map((pair) => pair.trim().split(' ').map(Number));
      const xs = nums.map(([x]) => x);
      const ys = nums.map(([, y]) => y);
      return {w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), top: Math.min(...ys)};
    });

describe('logo geometry', () => {
  it('uses the app canvas and accent', () => {
    expect(BRAND_INK).toBe(DARK_PALETTE.canvas);
    expect(BRAND_ROAD).toBe(ORANGE_ACCENT.base);
  });

  it('keeps the road inside the tile', () => {
    const [road] = boxes(roadPath());
    expect(road.top).toBeGreaterThan(0);
    expect(road.top + road.h).toBeLessThanOrEqual(LOGO_SIZE + 0.1);
  });

  it('loops seamlessly: a whole dash period later the dashes are where they started', () => {
    expect(centreDashes(1)).toBe(centreDashes(0));
    expect(centreDashes(0.5)).not.toBe(centreDashes(0));
  });

  it('draws dashes smaller toward the horizon', () => {
    const dashes = boxes(centreDashes(0));
    expect(dashes.length).toBeGreaterThanOrEqual(5);
    // Ordered near to far: each sits higher up and is shorter than the one before.
    for (let i = 1; i < dashes.length; i++) {
      expect(dashes[i].top).toBeLessThan(dashes[i - 1].top);
      expect(dashes[i].h).toBeLessThan(dashes[i - 1].h);
    }
  });
});
