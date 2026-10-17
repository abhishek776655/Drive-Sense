import {distanceUnit, formatDistance, formatSpeed, formatTemperature, kmhInUnits, speedUnit, speedValue} from '../units';

describe('units', () => {
  it('formats speed in km/h or mph', () => {
    expect(formatSpeed(27.78, 'metric')).toBe('100');
    expect(formatSpeed(27.78, 'imperial')).toBe('62');
    expect(formatSpeed(null, 'imperial')).toBe('–');
    expect(speedValue(10, 'metric')).toBeCloseTo(36);
  });

  it('formats distance in km or miles, one decimal under 100', () => {
    expect(formatDistance(14200, 'metric')).toBe('14.2');
    expect(formatDistance(14200, 'imperial')).toBe('8.8');
    expect(formatDistance(250000, 'metric')).toBe('250');
    expect(formatDistance(undefined, 'metric')).toBe('–');
  });

  it('names the units', () => {
    expect([speedUnit('metric'), speedUnit('imperial'), distanceUnit('metric'), distanceUnit('imperial')]).toEqual(['km/h', 'mph', 'km', 'mi']);
  });

  it('shows a km/h setting in the chosen unit', () => {
    expect(kmhInUnits(100, 'metric')).toBe(100);
    expect(kmhInUnits(100, 'imperial')).toBe(62);
  });

  it('converts temperature', () => {
    expect(formatTemperature(22, 'c')).toBe('22°');
    expect(formatTemperature(22, 'f')).toBe('72°');
    expect(formatTemperature(null, 'f')).toBe('–');
  });
});
