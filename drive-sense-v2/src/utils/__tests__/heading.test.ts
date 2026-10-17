import {bearingBetween, compass16, formatHeading, headingDelta, lookAhead, resolveHeading, smoothHeading} from '../heading';
import {horizontalAccel, smoothnessFor, toG} from '../motion';

const P = {latitude: 28.6, longitude: 77.2};

describe('heading', () => {
  it('takes the shortest way round', () => {
    expect(headingDelta(350, 10)).toBe(20);
    expect(headingDelta(10, 350)).toBe(-20);
    expect(smoothHeading(350, 10, 0.5)).toBe(0);
  });

  it('gives compass bearings between points', () => {
    expect(bearingBetween(P, {latitude: 28.61, longitude: 77.2})).toBeCloseTo(0, 0);
    expect(bearingBetween(P, {latitude: 28.6, longitude: 77.21})).toBeCloseTo(90, 0);
  });

  it('uses GPS course when moving, bearing as fallback, and holds when stopped', () => {
    const base = {previousPoint: P, point: {latitude: 28.6001, longitude: 77.2}, stepMeters: 11};
    expect(resolveHeading({...base, previousHeading: null, speedMps: 10, nativeHeading: 45})).toBe(45);
    expect(resolveHeading({...base, previousHeading: null, speedMps: 0.5, nativeHeading: 45})).toBeCloseTo(0, 0);
    expect(resolveHeading({...base, previousHeading: 120, speedMps: 0, nativeHeading: -1, stepMeters: 1})).toBe(120);
    expect(resolveHeading({...base, previousHeading: null, speedMps: 0, nativeHeading: null, stepMeters: 1})).toBeNull();
  });

  it('smooths a new reading into the held heading', () => {
    const next = resolveHeading({previousHeading: 0, previousPoint: P, point: P, speedMps: 10, nativeHeading: 100, stepMeters: 0});
    expect(next).toBeCloseTo(42, 5);
  });

  it('formats 16-point compass with degrees', () => {
    expect(compass16(212)).toBe('SSW');
    expect(formatHeading(212.4)).toBe('212° SSW');
    expect(formatHeading(359.8)).toBe('0° N');
  });

  it('projects a look-ahead point along the heading', () => {
    const ahead = lookAhead(P, 0, 111.32);
    expect(ahead.latitude).toBeCloseTo(28.601, 6);
    expect(ahead.longitude).toBeCloseTo(77.2, 6);
  });
});

describe('motion', () => {
  it('removes gravity and bands against the event thresholds', () => {
    expect(horizontalAccel(0)).toBeNull();
    expect(horizontalAccel(9.81)).toBe(0);
    expect(smoothnessFor(horizontalAccel(10.3))).toBe('moderate');
    expect(smoothnessFor(horizontalAccel(11))).toBe('harsh');
    expect(smoothnessFor(1)).toBe('smooth');
    expect(smoothnessFor(null)).toBeNull();
    expect(toG(9.81)).toBe(1);
  });
});
