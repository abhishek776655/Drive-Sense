import {analyseTrip} from '..';
import {pt} from '../../../testUtils/tripPoints';
import {cleanPoints} from '../prepare';
import {speedSegments, speedSeries} from '../series';

const colors = {cyan: '#000000', green: '#640000', amber: '#C80000', accent: '#FF0000', red: '#FFFFFF'};

describe('speedSegments', () => {
  it('merges neighbours of the same colour bucket and joins lines end to start', () => {
    const pts = cleanPoints([
      ...Array.from({length: 5}, (_, i) => pt(i, i * 10, 10)),
      ...Array.from({length: 5}, (_, i) => pt(5 + i, 50 + i * 25, 25)),
    ]);
    const lines = speedSegments(pts, colors);
    expect(lines.length).toBe(2);
    expect(lines[0].coords[lines[0].coords.length - 1]).toEqual(lines[1].coords[0]);
  });

  it('is empty for fewer than two points', () => {
    expect(speedSegments(cleanPoints([pt(0, 0, 10)]), colors)).toEqual([]);
  });
});

describe('speedSeries', () => {
  it('caps samples and always keeps the peak', () => {
    const pts = cleanPoints(Array.from({length: 1000}, (_, i) => pt(i, i * 10, i === 333 ? 10.5 : 10)));
    const {samples, peak} = speedSeries(pts, 50);
    expect(samples.length).toBeLessThanOrEqual(51);
    expect(peak!.kmh).toBeCloseTo(37.8);
    expect(samples.some((s) => s.t === peak!.t)).toBe(true);
  });
});

describe('analyseTrip', () => {
  it('handles a trip with no points', () => {
    const a = analyseTrip([]);
    expect(a.route).toEqual([]);
    expect(a.elevation).toBeNull();
    expect(a.stops).toEqual([]);
    expect(a.speed.peak).toBeNull();
  });
});
