import {nearestIndex} from '../ChartScrub';

describe('nearestIndex', () => {
  const xs = [0, 10, 20, 40];
  it('picks the closest point', () => {
    expect(nearestIndex(xs, -5)).toBe(0);
    expect(nearestIndex(xs, 4)).toBe(0);
    expect(nearestIndex(xs, 6)).toBe(1);
    expect(nearestIndex(xs, 31)).toBe(3);
    expect(nearestIndex(xs, 99)).toBe(3);
  });
  it('is -1 for nothing', () => expect(nearestIndex([], 5)).toBe(-1));
});
