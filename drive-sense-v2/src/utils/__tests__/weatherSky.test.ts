import {skyGradient, skyKind} from '../weatherSky';

describe('weather sky colours', () => {
  it('classifies WMO weather codes', () => {
    expect(skyKind(0)).toBe('clear');
    expect(skyKind(2)).toBe('partly');
    expect(skyKind(3)).toBe('overcast');
    expect(skyKind(45)).toBe('fog');
    expect(skyKind(53)).toBe('drizzle');
    expect(skyKind(63)).toBe('rain');
    expect(skyKind(82)).toBe('rain');
    expect(skyKind(75)).toBe('snow');
    expect(skyKind(95)).toBe('storm');
  });

  it('clear days are light sky, rain is dark blue, nights are darker than days', () => {
    const lightness = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(lightness(skyGradient(0, true)[1])).toBeGreaterThan(lightness(skyGradient(63, true)[1]));
    expect(lightness(skyGradient(0, false)[1])).toBeLessThan(lightness(skyGradient(0, true)[1]));
  });
});
