import {linePath} from '../chartPath';

describe('linePath', () => {
  it('maps the data range onto the box and closes the area to the baseline', () => {
    const {line, area, toXY} = linePath([{x: 0, y: 0}, {x: 10, y: 10}], 100, 50, 0);
    expect(toXY({x: 0, y: 0})).toEqual({x: 0, y: 50});
    expect(toXY({x: 10, y: 10})).toEqual({x: 100, y: 0});
    expect(line).toBe('M0 50L100 0');
    expect(area).toBe('M0 50L100 0L100 50L0 50Z');
  });

  it('handles a flat series without dividing by zero', () => {
    const {line} = linePath([{x: 0, y: 5}, {x: 1, y: 5}], 100, 50, 0);
    expect(line).not.toContain('NaN');
  });

  it('keeps a small range from filling the whole height', () => {
    const {toXY} = linePath([{x: 0, y: 0}, {x: 1, y: 4}], 100, 100, 0, 20);
    expect(toXY({x: 1, y: 4}).y).toBe(80);
  });

  it('is empty for no values', () => {
    expect(linePath([], 100, 50).line).toBe('');
  });
});
