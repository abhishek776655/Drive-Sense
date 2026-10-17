import {bumpLayout, DEFAULT_BUMP, MOCKUP_V9_BUMP} from '../bumpPath';

const numbers = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('bumpLayout', () => {
  it('matches the v9 mockup geometry for a 266-wide sheet', () => {
    const {path, center, bodyTop} = bumpLayout(266, 170, MOCKUP_V9_BUMP);
    expect(center).toEqual({x: 133, y: 66});
    expect(bodyTop).toBe(46);
    expect(path).toContain('L61.87 46');
    expect(path).toContain('72.81 38.92');
    expect(path).toContain('193.19 38.92');
    expect(path).toContain('204.13 46');
  });

  it('is symmetric about the centre line', () => {
    const {path} = bumpLayout(300, 200);
    expect(path).toContain(`A${DEFAULT_BUMP.radius} ${DEFAULT_BUMP.radius} 0 0 1`);
    const xs = numbers(path);
    expect(xs.every((n) => n >= 0 && n <= 300)).toBe(true);
  });

  it('closes the outline and keeps the bump top at y=0', () => {
    const {path, center, bodyTop} = bumpLayout(266, 232, DEFAULT_BUMP);
    expect(path.endsWith('Z')).toBe(true);
    expect(path).toContain('L266 204');
    expect(center.y).toBe(DEFAULT_BUMP.radius);
    expect(bodyTop).toBe(DEFAULT_BUMP.rise);
  });
});
