import {gappedPath} from '../CarSection';

describe('gappedPath', () => {
  it('bridges short gaps and breaks long ones', () => {
    const t = [0, 5, 10, 40, 45];
    const d = gappedPath(t, [80, null, 82, 85, 86], 100, 50);
    // One move to start, a line across the 10 s gap, a new move after the 30 s gap.
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d.match(/L/g)).toHaveLength(2);
  });

  it('draws nothing with fewer than two readings', () => {
    expect(gappedPath([0, 1], [null, 3], 100, 50)).toBe('');
  });
});
