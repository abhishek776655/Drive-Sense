import {arcPath, clampFraction, polar, resolveScaleKmh, valueToAngle} from '../gaugeMath';

describe('gaugeMath', () => {
  it('maps 0 to the start and the scale max to the end of the 270° sweep', () => {
    expect(valueToAngle(0, 200)).toBe(135);
    expect(valueToAngle(200, 200)).toBe(405);
    expect(valueToAngle(100, 200)).toBe(270);
  });

  it('clamps out-of-range and missing values', () => {
    expect(valueToAngle(500, 200)).toBe(405);
    expect(valueToAngle(-10, 200)).toBe(135);
    expect(clampFraction(null, 200)).toBe(0);
    expect(clampFraction(Number.NaN, 200)).toBe(0);
    expect(clampFraction(50, 0)).toBe(0);
  });

  it('auto scale grows with top speed; fixed scales pass through', () => {
    expect(resolveScaleKmh('auto', null)).toBe(120);
    expect(resolveScaleKmh('auto', 100)).toBe(120);
    expect(resolveScaleKmh('auto', 150)).toBe(200);
    expect(resolveScaleKmh('auto', 220)).toBe(300);
    expect(resolveScaleKmh(200, 10)).toBe(200);
  });

  it('draws nothing for an empty sweep and uses the large-arc flag past 180°', () => {
    expect(arcPath(100, 100, 80, 135, 135)).toBe('');
    expect(arcPath(100, 100, 80, 135, 405)).toContain(' 0 1 1 ');
    expect(arcPath(100, 100, 80, 135, 200)).toContain(' 0 0 1 ');
  });

  it('places polar points clockwise from 3 o\'clock', () => {
    const top = polar(100, 100, 50, 270);
    expect(top.x).toBeCloseTo(100);
    expect(top.y).toBeCloseTo(50);
  });
});
