import {EMPTY_ROUGH, roadLevel, roadSummary, stepRough, verticalAccel} from '../roughness';

describe('road roughness', () => {
  it('takes the bump along gravity', () => {
    expect(verticalAccel({x: 0, y: 0, z: 2}, {x: 0, y: 0, z: -9.81})).toBeCloseTo(-2, 5);
    expect(verticalAccel({x: 0, y: 1.5, z: 0}, {x: 0, y: -9.81, z: 0})).toBeCloseTo(-1.5, 5);
  });

  it('buckets RMS vibration', () => {
    expect(roadLevel(0.3)).toBe('smooth');
    expect(roadLevel(1)).toBe('fair');
    expect(roadLevel(2)).toBe('rough');
  });

  it('closes a segment every 100 m with its RMS and where it ended', () => {
    let s = EMPTY_ROUGH;
    for (let d = 0; d <= 100; d += 10) {
      s = stepRough(s, d % 20 === 0 ? 2 : -2, d, {latitude: d, longitude: 0});
    }
    for (let d = 110; d <= 200; d += 10) {
      s = stepRough(s, 0.2, d, {latitude: d, longitude: 0});
    }
    expect(s.segments).toHaveLength(2);
    expect(s.segments[0]).toMatchObject({level: 'rough', latitude: 100});
    expect(s.segments[0].rms).toBeCloseTo(2, 5);
    expect(s.segments[1]).toMatchObject({level: 'smooth', latitude: 200});
    expect(roadSummary(s.segments)).toEqual({smooth: 0.5, fair: 0, rough: 0.5});
    expect(roadSummary([])).toBeNull();
  });
});
